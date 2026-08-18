package com.example.cuycitogoadmin.data.repository

import android.content.Context
import com.example.cuycitogoadmin.data.model.ClientModel
import com.example.cuycitogoadmin.data.model.ProductModel
import com.example.cuycitogoadmin.data.model.RecargaModel
import com.example.cuycitogoadmin.data.model.TvActivationModel
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class FirebaseManager(private val context: Context) {

    private val auth: FirebaseAuth by lazy {
        ensureFirebaseInitialized()
        FirebaseAuth.getInstance()
    }

    private val firestore: FirebaseFirestore by lazy {
        ensureFirebaseInitialized()
        FirebaseFirestore.getInstance()
    }

    private fun ensureFirebaseInitialized() {
        if (FirebaseApp.getApps(context).isEmpty()) {
            val options = FirebaseOptions.Builder()
                .setApiKey("AIzaSyC-_c45ORNlmAT3dlGOBXjOjkwrT6yx5F4")
                .setApplicationId("1:528964293797:android:com.example.cuycitogoadmin")
                .setProjectId("cuycitogo-app")
                .setStorageBucket("cuycitogo-app.firebasestorage.app")
                .setGcmSenderId("528964293797")
                .build()
            FirebaseApp.initializeApp(context, options)
        }
    }

    // --- AUTHENTICATION ---
    fun isUserLoggedIn(): Boolean = auth.currentUser != null

    fun getCurrentUserEmail(): String = auth.currentUser?.email ?: "Admin"

    suspend fun loginAdmin(email: String, pass: String): Result<Boolean> {
        return try {
            auth.signInWithEmailAndPassword(email.trim(), pass.trim()).await()
            Result.success(true)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun logout() {
        auth.signOut()
    }

    // --- RECARGAS (REAL-TIME) ---
    fun getRecargasFlow(): Flow<List<RecargaModel>> = callbackFlow {
        val listener: ListenerRegistration = firestore.collection("recharge_orders")
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }
                if (snapshot != null) {
                    val list = snapshot.documents.mapNotNull { doc ->
                        try {
                            val data = doc.data ?: return@mapNotNull null
                            val amountVal = when (val raw = data["amount"]) {
                                is Number -> raw.toDouble()
                                is String -> raw.toDoubleOrNull() ?: 0.0
                                else -> 0.0
                            }
                            RecargaModel(
                                id = doc.id,
                                clientName = data["clientName"] as? String ?: data["name"] as? String ?: "Cliente",
                                clientEmail = data["clientEmail"] as? String ?: data["email"] as? String ?: "",
                                amount = amountVal,
                                paymentMethod = data["paymentMethod"] as? String ?: data["method"] as? String ?: "Yape",
                                voucherUrl = data["voucherUrl"] as? String ?: data["imageUrl"] as? String ?: "",
                                status = data["status"] as? String ?: "pending",
                                referenceCode = data["referenceCode"] as? String ?: data["operationNumber"] as? String ?: "",
                                date = data["date"] as? String ?: "Hoy"
                            )
                        } catch (e: Exception) {
                            null
                        }
                    }
                    trySend(list)
                }
            }
        awaitClose { listener.remove() }
    }

    suspend fun approveRecarga(recarga: RecargaModel): Result<Boolean> {
        return try {
            // 1. Actualizar orden
            firestore.collection("recharge_orders").document(recarga.id)
                .update("status", "approved", "verifiedAt", System.currentTimeMillis().toString())
                .await()

            // 2. Sumar saldo al cliente en la colección "users"
            if (recarga.clientEmail.isNotBlank()) {
                val querySnap = firestore.collection("users")
                    .whereEqualTo("email", recarga.clientEmail)
                    .get()
                    .await()

                for (doc in querySnap.documents) {
                    val currentBal = (doc.getDouble("balance") ?: 0.0)
                    doc.reference.update("balance", currentBal + recarga.amount).await()
                }
            }
            Result.success(true)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun rejectRecarga(recargaId: String, reason: String = "Comprobante no válido"): Result<Boolean> {
        return try {
            firestore.collection("recharge_orders").document(recargaId)
                .update("status", "rejected", "rejectReason", reason)
                .await()
            Result.success(true)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // --- ACTIVACIONES DE TV (QR CODES REAL-TIME) ---
    fun getTvActivationsFlow(): Flow<List<TvActivationModel>> = callbackFlow {
        val listener: ListenerRegistration = firestore.collection("subscriptions")
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }
                if (snapshot != null) {
                    val list = snapshot.documents.mapNotNull { doc ->
                        try {
                            val data = doc.data ?: return@mapNotNull null
                            val statusStr = data["status"] as? String ?: ""
                            val qrUrl = data["tvQrUrl"] as? String ?: data["qrImageUrl"] as? String ?: data["qrCode"] as? String ?: ""
                            val pin = data["pinCode"] as? String ?: data["code"] as? String ?: ""

                            // Incluir si tiene estado pendiente o tiene imagen QR/código
                            if (statusStr.contains("Pendiente", ignoreCase = true) || qrUrl.isNotBlank() || pin.isNotBlank()) {
                                TvActivationModel(
                                    id = doc.id,
                                    person = data["person"] as? String ?: data["clientName"] as? String ?: "Cliente",
                                    email = data["email"] as? String ?: "",
                                    service = data["service"] as? String ?: "Streaming TV",
                                    accountEmail = data["accountEmail"] as? String ?: "",
                                    pinCode = pin,
                                    qrImageUrl = qrUrl,
                                    status = statusStr.ifBlank { "Pendiente de activación" },
                                    requestedAt = data["startDate"] as? String ?: "Hoy",
                                    profileName = data["profileName"] as? String ?: "Pantalla 1"
                                )
                            } else {
                                null
                            }
                        } catch (e: Exception) {
                            null
                        }
                    }
                    trySend(list)
                }
            }
        awaitClose { listener.remove() }
    }

    suspend fun markTvActivated(activationId: String): Result<Boolean> {
        return try {
            firestore.collection("subscriptions").document(activationId)
                .update("status", "Activo", "activatedAt", System.currentTimeMillis().toString())
                .await()
            Result.success(true)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // --- CLIENTES REGISTRADOS (REAL-TIME) ---
    fun getClientsFlow(): Flow<List<ClientModel>> = callbackFlow {
        val listener: ListenerRegistration = firestore.collection("users")
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }
                if (snapshot != null) {
                    val list = snapshot.documents.mapNotNull { doc ->
                        try {
                            val data = doc.data ?: return@mapNotNull null
                            val balVal = when (val raw = data["balance"]) {
                                is Number -> raw.toDouble()
                                is String -> raw.toDoubleOrNull() ?: 0.0
                                else -> 0.0
                            }
                            ClientModel(
                                id = doc.id,
                                name = data["name"] as? String ?: data["username"] as? String ?: "Cliente",
                                email = data["email"] as? String ?: "",
                                phone = data["phone"] as? String ?: data["whatsapp"] as? String ?: "",
                                balance = balVal,
                                isVip = data["isVip"] as? Boolean ?: true,
                                status = data["status"] as? String ?: "Activo",
                                registeredAt = data["createdAt"] as? String ?: "Registrado"
                            )
                        } catch (e: Exception) {
                            null
                        }
                    }
                    trySend(list)
                }
            }
        awaitClose { listener.remove() }
    }

    // --- TIENDA Y CATÁLOGO ---
    fun getCatalogFlow(): Flow<List<ProductModel>> = callbackFlow {
        val listener: ListenerRegistration = firestore.collection("store_catalog")
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }
                if (snapshot != null) {
                    val list = snapshot.documents.mapNotNull { doc ->
                        try {
                            val data = doc.data ?: return@mapNotNull null
                            val priceVal = when (val raw = data["price"]) {
                                is Number -> raw.toDouble()
                                is String -> raw.toDoubleOrNull() ?: 0.0
                                else -> 0.0
                            }
                            val stockVal = when (val raw = data["stock"]) {
                                is Number -> raw.toInt()
                                is String -> raw.toIntOrNull() ?: 10
                                else -> 10
                            }
                            ProductModel(
                                id = doc.id,
                                name = data["name"] as? String ?: "Servicio Streaming",
                                price = priceVal,
                                platform = data["platform"] as? String ?: "NETFLIX",
                                category = data["category"] as? String ?: "STREAMING",
                                badge = data["badge"] as? String ?: "VIP",
                                stock = stockVal,
                                description = data["description"] as? String ?: ""
                            )
                        } catch (e: Exception) {
                            null
                        }
                    }
                    trySend(list)
                }
            }
        awaitClose { listener.remove() }
    }
}
