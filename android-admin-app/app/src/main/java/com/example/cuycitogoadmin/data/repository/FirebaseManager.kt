package com.example.cuycitogoadmin.data.repository

import android.content.Context
import com.example.cuycitogoadmin.data.model.*
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.*

class FirebaseManager(private val context: Context) {

    private val auth: FirebaseAuth by lazy {
        initFirebaseIfNeeded()
        FirebaseAuth.getInstance()
    }

    private val firestore: FirebaseFirestore by lazy {
        initFirebaseIfNeeded()
        FirebaseFirestore.getInstance()
    }

    private fun initFirebaseIfNeeded() {
        if (FirebaseApp.getApps(context).isEmpty()) {
            val options = com.google.firebase.FirebaseOptions.Builder()
                .setApiKey("AIzaSyC-_c45ORNlmAT3dlGOBXjOjkwrT6yx5F4")
                .setApplicationId("1:528964293797:android:1234567890abcdef")
                .setProjectId("cuycitogo-app")
                .setStorageBucket("cuycitogo-app.firebasestorage.app")
                .build()
            FirebaseApp.initializeApp(context, options)
        }
    }

    // --- AUTENTICACION ---
    fun isUserLoggedIn(): Boolean = auth.currentUser != null

    fun getCurrentUserEmail(): String = auth.currentUser?.email ?: "Administrador"

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
                            val amountVal = when (val raw = data["exactAmount"] ?: data["baseAmount"] ?: data["amount"] ?: data["monto"]) {
                                is Number -> raw.toDouble()
                                is String -> raw.toDoubleOrNull() ?: 0.0
                                else -> 0.0
                            }
                            val rawTs = when (val raw = data["createdAt"] ?: data["timestamp"] ?: data["date"]) {
                                is Number -> raw.toLong()
                                is com.google.firebase.Timestamp -> raw.toDate().time
                                is String -> {
                                    try {
                                        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault()).parse(raw.take(19))?.time ?: System.currentTimeMillis()
                                    } catch (e: Exception) {
                                        System.currentTimeMillis()
                                    }
                                }
                                else -> System.currentTimeMillis()
                            }
                            val statusRaw = (data["status"] as? String ?: "pending_manual").trim()
                            RecargaModel(
                                id = doc.id,
                                clientName = data["userName"] as? String ?: data["name"] as? String ?: data["userNickname"] as? String ?: "Cliente",
                                clientEmail = data["userEmail"] as? String ?: data["email"] as? String ?: "",
                                amount = amountVal,
                                paymentMethod = data["paymentMethod"] as? String ?: data["method"] as? String ?: "Yape / Plin",
                                voucherUrl = data["voucherUrl"] as? String ?: data["imageUrl"] as? String ?: data["receiptUrl"] as? String ?: data["voucher"] as? String ?: "",
                                status = statusRaw,
                                referenceCode = data["referenceCode"] as? String ?: data["ref"] as? String ?: data["id"] as? String ?: "",
                                date = data["date"] as? String ?: "",
                                timestamp = rawTs
                            )
                        } catch (e: Exception) {
                            null
                        }
                    }.sortedByDescending { it.timestamp }
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

            // 2. Sumar saldo al cliente en la coleccion "users"
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

    suspend fun rejectRecarga(recargaId: String, reason: String = "Comprobante no valido"): Result<Boolean> {
        return try {
            firestore.collection("recharge_orders").document(recargaId)
                .update("status", "rejected", "rejectReason", reason)
                .await()
            Result.success(true)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // --- ACTIVACIONES DE TV, SPOTIFY Y SERVICIOS (REAL-TIME) ---
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
                            val statusStr = (data["status"] as? String ?: "").trim()
                            val qrUrl = data["tvQrUrl"] as? String ?: data["tvQrImage"] as? String ?: data["qrImageUrl"] as? String ?: data["qrCode"] as? String ?: ""
                            val pin = data["pinCode"] as? String ?: data["pin"] as? String ?: data["code"] as? String ?: ""
                            val priceVal = when (val raw = data["price"] ?: data["cost"] ?: data["amount"]) {
                                is Number -> raw.toDouble()
                                is String -> raw.toDoubleOrNull() ?: 0.0
                                else -> 0.0
                            }

                            val rawTs = when (val raw = data["createdAt"]) {
                                is Number -> raw.toLong()
                                is com.google.firebase.Timestamp -> raw.toDate().time
                                else -> System.currentTimeMillis()
                            }

                            TvActivationModel(
                                id = doc.id,
                                person = data["person"] as? String ?: data["clientName"] as? String ?: data["name"] as? String ?: "Cliente",
                                email = data["email"] as? String ?: data["userEmail"] as? String ?: "",
                                service = data["service"] as? String ?: data["name"] as? String ?: "Streaming VIP",
                                accountEmail = data["accountEmail"] as? String ?: data["email"] as? String ?: "",
                                accountPassword = data["accountPassword"] as? String ?: data["pass"] as? String ?: "",
                                pinCode = pin,
                                qrImageUrl = qrUrl,
                                spotifyEmail = data["spotifyEmail"] as? String ?: "",
                                spotifyPassword = data["spotifyPassword"] as? String ?: "",
                                spotifyOtpCode = data["spotifyOtpCode"] as? String ?: data["otpCode"] as? String ?: "",
                                status = statusStr.ifBlank { "Pendiente de activacion" },
                                requestedAt = data["startDate"] as? String ?: data["createdAt"] as? String ?: "Hoy",
                                profileName = data["profileName"] as? String ?: "Pantalla 1",
                                price = priceVal,
                                rawTimestamp = rawTs
                            )
                        } catch (e: Exception) {
                            null
                        }
                    }.sortedByDescending { it.rawTimestamp }
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

    // --- SISTEMA UNIFICADO DE ALARMAS & REGISTRO EN TIEMPO REAL ---
    fun getLiveAlarmsFlow(): Flow<List<AlarmEventModel>> {
        val dateFormat = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())

        return combine(getRecargasFlow(), getTvActivationsFlow()) { recargas, subscriptions ->
            val alarmList = mutableListOf<AlarmEventModel>()

            // 1. Convertir Recargas
            recargas.forEach { r ->
                val sLower = r.status.lowercase()
                val isPend = sLower.contains("pending") || sLower.contains("manual") || sLower.contains("pendiente") || sLower.contains("wait")
                alarmList.add(
                    AlarmEventModel(
                        id = "recarga_${r.id}",
                        category = AlarmCategory.RECARGA_PENDIENTE,
                        title = "Recarga ${r.paymentMethod.uppercase()}: S/ %.2f".format(r.amount),
                        customerName = r.clientName.ifBlank { "Cliente Cuycito" },
                        customerEmail = r.clientEmail,
                        amount = r.amount,
                        detail = "Metodo: ${r.paymentMethod} - Ref: ${r.referenceCode.ifBlank { "N/A" }}",
                        status = r.status,
                        imageUrl = r.voucherUrl,
                        rawTimestamp = r.timestamp,
                        timeFormatted = try { dateFormat.format(Date(r.timestamp)) } catch (e: Exception) { "Reciente" },
                        isPending = isPend,
                        originalRecarga = r
                    )
                )
            }

            // 2. Convertir Compras de Servicios / Activaciones
            subscriptions.forEach { s ->
                val sLower = s.status.lowercase()
                val isPend = sLower.contains("pending") || sLower.contains("pendiente") || sLower.contains("proceso")
                val sName = s.service.lowercase()

                val category = when {
                    sName.contains("spotify") -> AlarmCategory.ACTIVACION_SPOTIFY
                    sName.contains("crunchyroll") || sName.contains("crunchy") -> AlarmCategory.ACTIVACION_CRUNCHYROLL
                    sName.contains("netflix") || sName.contains("disney") || sName.contains("prime") || sName.contains("hbo") || sName.contains("max") -> AlarmCategory.ACTIVACION_TV
                    else -> AlarmCategory.COMPRA_SERVICIO
                }

                val detailText = when (category) {
                    AlarmCategory.ACTIVACION_SPOTIFY -> {
                        if (s.spotifyOtpCode.isNotBlank()) "Spotify: ${s.spotifyEmail.ifBlank { "Cliente" }} | OTP: ${s.spotifyOtpCode}"
                        else if (s.spotifyEmail.isNotBlank()) "Spotify: ${s.spotifyEmail} | Clave: ${s.spotifyPassword}"
                        else "Spotify: Esperando credenciales del cliente"
                    }
                    AlarmCategory.ACTIVACION_CRUNCHYROLL -> {
                        if (s.accountEmail.isNotBlank()) "Crunchyroll: ${s.accountEmail} | Pass: ${s.accountPassword}"
                        else "Crunchyroll: Entrega de Credenciales Directas"
                    }
                    AlarmCategory.ACTIVACION_TV -> {
                        if (s.qrImageUrl.isNotBlank()) "TV Smart: Foto QR recibida"
                        else "TV Smart: Esperando QR de TV del cliente"
                    }
                    else -> "Perfil: ${s.profileName}"
                }

                alarmList.add(
                    AlarmEventModel(
                        id = "sub_${s.id}",
                        category = category,
                        title = "Compra: ${s.service.uppercase()}",
                        customerName = s.person.ifBlank { "Cliente VIP" },
                        customerEmail = s.email,
                        amount = s.price,
                        detail = detailText,
                        status = s.status,
                        imageUrl = s.qrImageUrl,
                        pinCode = s.pinCode,
                        spotifyEmail = s.spotifyEmail,
                        spotifyPassword = s.spotifyPassword,
                        spotifyOtpCode = s.spotifyOtpCode,
                        accountEmail = s.accountEmail,
                        accountPassword = s.accountPassword,
                        rawTimestamp = s.rawTimestamp,
                        timeFormatted = s.requestedAt.ifBlank { "Reciente" },
                        isPending = isPend,
                        originalTv = s
                    )
                )
            }

            // Ordenar por más reciente primero
            alarmList.sortedByDescending { it.rawTimestamp }
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

    // --- TIENDA Y CATALOGO ---
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