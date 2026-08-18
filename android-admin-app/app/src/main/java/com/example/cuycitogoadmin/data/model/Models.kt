package com.example.cuycitogoadmin.data.model

enum class AlarmCategory(val displayName: String) {
    RECARGA_PENDIENTE("Recarga por Verificar"),
    COMPRA_SERVICIO("Nueva Compra de Servicio"),
    ACTIVACION_TV("Activacion de TV Smart")
}

data class AlarmEventModel(
    val id: String = "",
    val category: AlarmCategory = AlarmCategory.RECARGA_PENDIENTE,
    val title: String = "",
    val customerName: String = "",
    val customerEmail: String = "",
    val amount: Double = 0.0,
    val detail: String = "",
    val status: String = "pending", // pending, approved, rejected, Activo, pending_activation
    val imageUrl: String = "",
    val pinCode: String = "",
    val rawTimestamp: Long = System.currentTimeMillis(),
    val timeFormatted: String = "",
    val isPending: Boolean = true,
    val originalRecarga: RecargaModel? = null,
    val originalTv: TvActivationModel? = null
)

data class RecargaModel(
    val id: String = "",
    val clientName: String = "",
    val clientEmail: String = "",
    val amount: Double = 0.0,
    val paymentMethod: String = "Yape",
    val voucherUrl: String = "",
    val status: String = "pending", // pending, approved, rejected
    val referenceCode: String = "",
    val date: String = "",
    val timestamp: Long = System.currentTimeMillis()
)

data class TvActivationModel(
    val id: String = "",
    val person: String = "",
    val email: String = "",
    val service: String = "",
    val accountEmail: String = "",
    val pinCode: String = "",
    val qrImageUrl: String = "",
    val status: String = "Pendiente de activacion", // Pendiente de activacion, Activo
    val requestedAt: String = "",
    val profileName: String = "",
    val price: Double = 0.0,
    val rawTimestamp: Long = System.currentTimeMillis()
)

data class ClientModel(
    val id: String = "",
    val name: String = "",
    val email: String = "",
    val phone: String = "",
    val balance: Double = 0.0,
    val isVip: Boolean = false,
    val status: String = "Activo",
    val registeredAt: String = ""
)

data class ProductModel(
    val id: String = "",
    val name: String = "",
    val price: Double = 0.0,
    val platform: String = "NETFLIX",
    val category: String = "STREAMING",
    val badge: String = "VIP",
    val stock: Int = 10,
    val description: String = ""
)