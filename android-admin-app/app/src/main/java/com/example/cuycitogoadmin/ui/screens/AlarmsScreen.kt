package com.example.cuycitogoadmin.ui.screens

import android.widget.Toast
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import coil.compose.AsyncImage
import com.example.cuycitogoadmin.data.model.AlarmCategory
import com.example.cuycitogoadmin.data.model.AlarmEventModel
import com.example.cuycitogoadmin.data.model.RecargaModel
import com.example.cuycitogoadmin.theme.*
import kotlinx.coroutines.launch

@Composable
fun AlarmsScreen(
    alarms: List<AlarmEventModel>,
    onApproveRecarga: suspend (RecargaModel) -> Result<Boolean>,
    onRejectRecarga: suspend (String, String) -> Result<Boolean>,
    onMarkTvActivated: suspend (String) -> Result<Boolean>
) {
    var filterPendingOnly by remember { mutableStateOf(true) }
    var selectedVoucherUrl by remember { mutableStateOf<String?>(null) }
    var selectedQrUrl by remember { mutableStateOf<String?>(null) }
    var rejectDialogTargetId by remember { mutableStateOf<String?>(null) }
    var rejectReason by remember { mutableStateOf("") }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val pendingAlarms = remember(alarms) { alarms.filter { it.isPending } }
    val displayList = if (filterPendingOnly) pendingAlarms else alarms

    val pendingRecargasCount = remember(alarms) {
        alarms.count { it.isPending && it.category == AlarmCategory.RECARGA_PENDIENTE }
    }
    val pendingComprasCount = remember(alarms) {
        alarms.count { it.isPending && (it.category == AlarmCategory.COMPRA_SERVICIO || it.category == AlarmCategory.ACTIVACION_TV) }
    }

    // Animacion de pulso de radar
    val infiniteTransition = rememberInfiniteTransition(label = "RadarPulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 0.9f,
        targetValue = 1.15f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "PulseScale"
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CuycitoBlack)
            .padding(16.dp)
    ) {
        // --- RADAR STATUS BANNER ---
        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(
                containerColor = if (pendingAlarms.isEmpty()) Color(0xFF062015) else Color(0xFF270E0E)
            ),
            border = CardDefaults.outlinedCardBorder().copy(
                brush = Brush.horizontalGradient(
                    if (pendingAlarms.isEmpty()) listOf(CuycitoGreen, Color(0xFF059669))
                    else listOf(CuycitoRed, CuycitoGold)
                )
            ),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f)
                ) {
                    Box(
                        modifier = Modifier
                            .size(16.dp)
                            .scale(pulseScale)
                            .background(
                                if (pendingAlarms.isEmpty()) CuycitoGreen else CuycitoRed,
                                CircleShape
                            )
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = if (pendingAlarms.isEmpty()) "RADAR ACTIVO � 24/7 EN LINEA" else "�ATENCION REQUERIDA!",
                            color = if (pendingAlarms.isEmpty()) CuycitoGreen else CuycitoRed,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Black,
                            letterSpacing = 1.sp
                        )
                        Text(
                            text = if (pendingAlarms.isEmpty()) "Vigilando recargas y compras en vivo"
                            else "${pendingAlarms.size} alertas en espera de aprobacion",
                            color = Color.White,
                            fontSize = 12.sp
                        )
                    }
                }

                Box(
                    modifier = Modifier
                        .background(
                            if (pendingAlarms.isEmpty()) CuycitoGreen.copy(alpha = 0.2f) else CuycitoRed.copy(alpha = 0.2f),
                            RoundedCornerShape(8.dp)
                        )
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = if (pendingAlarms.isEmpty()) "AL DIA" else "${pendingAlarms.size} NUEVAS",
                        color = if (pendingAlarms.isEmpty()) CuycitoGreen else CuycitoRed,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // --- KPI RESUMEN DE ALARMAS ---
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = CuycitoDarkCard),
                border = CardDefaults.outlinedCardBorder().copy(
                    brush = androidx.compose.ui.graphics.SolidColor(
                        if (pendingRecargasCount > 0) CuycitoGold else CuycitoBorder
                    )
                ),
                modifier = Modifier.weight(1f)
            ) {
                Row(
                    modifier = Modifier.padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.AccountBalanceWallet,
                        contentDescription = null,
                        tint = if (pendingRecargasCount > 0) CuycitoGold else CuycitoTextSecondary,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Text("Recargas", color = CuycitoTextSecondary, fontSize = 10.sp)
                        Text(
                            "$pendingRecargasCount por verificar",
                            color = if (pendingRecargasCount > 0) CuycitoGold else Color.White,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = CuycitoDarkCard),
                border = CardDefaults.outlinedCardBorder().copy(
                    brush = androidx.compose.ui.graphics.SolidColor(
                        if (pendingComprasCount > 0) CuycitoCyan else CuycitoBorder
                    )
                ),
                modifier = Modifier.weight(1f)
            ) {
                Row(
                    modifier = Modifier.padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.ShoppingCart,
                        contentDescription = null,
                        tint = if (pendingComprasCount > 0) CuycitoCyan else CuycitoTextSecondary,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Text("Compras", color = CuycitoTextSecondary, fontSize = 10.sp)
                        Text(
                            "$pendingComprasCount por activar",
                            color = if (pendingComprasCount > 0) CuycitoCyan else Color.White,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // --- SELECTOR DE FILTRO: PENDIENTES VS HISTORIAL ---
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(
                selected = filterPendingOnly,
                onClick = { filterPendingOnly = true },
                label = { Text("Alarmas Activas (${pendingAlarms.size})", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = CuycitoGold,
                    selectedLabelColor = Color.Black,
                    containerColor = CuycitoDarkCard,
                    labelColor = CuycitoTextSecondary
                )
            )

            FilterChip(
                selected = !filterPendingOnly,
                onClick = { filterPendingOnly = false },
                label = { Text("Registro Completo (${alarms.size})", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = CuycitoGold,
                    selectedLabelColor = Color.Black,
                    containerColor = CuycitoDarkCard,
                    labelColor = CuycitoTextSecondary
                )
            )
        }

        Spacer(modifier = Modifier.height(10.dp))

        // --- LISTADO / WIDGET FEED ---
        if (displayList.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        modifier = Modifier
                            .size(70.dp)
                            .background(Color(0xFF062015), CircleShape)
                            .border(2.dp, CuycitoGreen, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = CuycitoGreen,
                            modifier = Modifier.size(40.dp)
                        )
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = if (filterPendingOnly) "�Todo al dia! Sin alarmas pendientes."
                        else "No hay eventos en el registro",
                        color = Color.White,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Cuando entre una recarga por verificar o se compre un servicio, aparecera aqui con alerta sonora y vibracion.",
                        color = CuycitoTextSecondary,
                        fontSize = 11.sp,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(displayList, key = { it.id }) { item ->
                    AlarmCard(
                        item = item,
                        onViewVoucher = { selectedVoucherUrl = it },
                        onViewQr = { selectedQrUrl = it },
                        onApproveRecarga = {
                            item.originalRecarga?.let { rec ->
                                scope.launch {
                                    val res = onApproveRecarga(rec)
                                    if (res.isSuccess) {
                                        Toast.makeText(context, "? Recarga aprobada (+S/ %.2f)".format(rec.amount), Toast.LENGTH_SHORT).show()
                                    } else {
                                        Toast.makeText(context, "Error: ${res.exceptionOrNull()?.message}", Toast.LENGTH_SHORT).show()
                                    }
                                }
                            }
                        },
                        onRejectRecargaClick = {
                            rejectDialogTargetId = item.originalRecarga?.id
                        },
                        onMarkActivated = {
                            item.originalTv?.let { tv ->
                                scope.launch {
                                    val res = onMarkTvActivated(tv.id)
                                    if (res.isSuccess) {
                                        Toast.makeText(context, "?? Servicio ${tv.service} activado", Toast.LENGTH_SHORT).show()
                                    } else {
                                        Toast.makeText(context, "Error: ${res.exceptionOrNull()?.message}", Toast.LENGTH_SHORT).show()
                                    }
                                }
                            }
                        }
                    )
                }
            }
        }
    }

    // --- MODAL VISOR VOUCHER ---
    if (selectedVoucherUrl != null) {
        Dialog(onDismissRequest = { selectedVoucherUrl = null }) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .wrapContentHeight()
                    .background(Color.Black, RoundedCornerShape(20.dp))
                    .border(2.dp, CuycitoGold, RoundedCornerShape(20.dp))
                    .padding(16.dp)
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Voucher de Recarga", color = CuycitoGold, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        IconButton(onClick = { selectedVoucherUrl = null }) {
                            Icon(Icons.Default.Close, contentDescription = null, tint = Color.White)
                        }
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                    AsyncImage(
                        model = selectedVoucherUrl,
                        contentDescription = "Comprobante",
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(380.dp)
                            .clip(RoundedCornerShape(12.dp)),
                        contentScale = ContentScale.Fit
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Button(
                        onClick = { selectedVoucherUrl = null },
                        colors = ButtonDefaults.buttonColors(containerColor = CuycitoDarkCard),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Cerrar", color = Color.White)
                    }
                }
            }
        }
    }

    // --- MODAL VISOR QR TV ---
    if (selectedQrUrl != null) {
        Dialog(onDismissRequest = { selectedQrUrl = null }) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .wrapContentHeight()
                    .background(Color.Black, RoundedCornerShape(20.dp))
                    .border(2.dp, CuycitoCyan, RoundedCornerShape(20.dp))
                    .padding(16.dp)
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Codigo QR de Smart TV", color = CuycitoCyan, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        IconButton(onClick = { selectedQrUrl = null }) {
                            Icon(Icons.Default.Close, contentDescription = null, tint = Color.White)
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    Box(
                        modifier = Modifier
                            .size(260.dp)
                            .background(Color.White, RoundedCornerShape(16.dp))
                            .padding(12.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        AsyncImage(
                            model = selectedQrUrl,
                            contentDescription = "QR TV",
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Fit
                        )
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    Button(
                        onClick = { selectedQrUrl = null },
                        colors = ButtonDefaults.buttonColors(containerColor = CuycitoDarkCard),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Cerrar", color = Color.White)
                    }
                }
            }
        }
    }

    // --- MODAL RECHAZAR RECARGA ---
    if (rejectDialogTargetId != null) {
        AlertDialog(
            onDismissRequest = { rejectDialogTargetId = null },
            title = { Text("Rechazar Recarga", color = CuycitoRed, fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    Text("Ingresa el motivo del rechazo para notificar al cliente:", color = Color.White, fontSize = 12.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = rejectReason,
                        onValueChange = { rejectReason = it },
                        placeholder = { Text("Ej: Comprobante no legible o duplicado", color = CuycitoTextSecondary, fontSize = 12.sp) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = CuycitoRed,
                            unfocusedBorderColor = CuycitoBorder,
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val targetId = rejectDialogTargetId ?: return@Button
                        val reasonText = rejectReason.ifBlank { "Comprobante no valido" }
                        scope.launch {
                            val res = onRejectRecarga(targetId, reasonText)
                            if (res.isSuccess) {
                                Toast.makeText(context, "Recarga rechazada", Toast.LENGTH_SHORT).show()
                            }
                            rejectDialogTargetId = null
                            rejectReason = ""
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CuycitoRed)
                ) {
                    Text("Confirmar Rechazo", color = Color.White, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { rejectDialogTargetId = null }) {
                    Text("Cancelar", color = CuycitoTextSecondary)
                }
            },
            containerColor = CuycitoDarkCard
        )
    }
}

@Composable
fun AlarmCard(
    item: AlarmEventModel,
    onViewVoucher: (String) -> Unit,
    onViewQr: (String) -> Unit,
    onApproveRecarga: () -> Unit,
    onRejectRecargaClick: () -> Unit,
    onMarkActivated: () -> Unit
) {
    val isRecarga = item.category == AlarmCategory.RECARGA_PENDIENTE
    val isTv = item.category == AlarmCategory.ACTIVACION_TV
    val isSpotify = item.category == AlarmCategory.ACTIVACION_SPOTIFY
    val isCrunchy = item.category == AlarmCategory.ACTIVACION_CRUNCHYROLL

    val badgeColor = when {
        item.isPending && isRecarga -> CuycitoRed
        item.isPending && isSpotify -> CuycitoGreen
        item.isPending && isCrunchy -> CuycitoGold
        item.isPending && isTv -> CuycitoCyan
        item.isPending -> CuycitoGold
        else -> CuycitoGreen
    }

    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = CuycitoDarkCard),
        border = CardDefaults.outlinedCardBorder().copy(
            brush = androidx.compose.ui.graphics.SolidColor(
                if (item.isPending) badgeColor else CuycitoBorder
            )
        ),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            // Header del Evento
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .background(badgeColor.copy(alpha = 0.2f), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = when {
                                isRecarga -> Icons.Default.AccountBalanceWallet
                                isSpotify -> Icons.Default.Headphones
                                isCrunchy -> Icons.Default.Movie
                                isTv -> Icons.Default.Tv
                                else -> Icons.Default.ShoppingCart
                            },
                            contentDescription = null,
                            tint = badgeColor,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = item.title,
                            color = Color.White,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "${item.customerName} - ${item.timeFormatted}",
                            color = CuycitoTextSecondary,
                            fontSize = 10.sp
                        )
                    }
                }

                Box(
                    modifier = Modifier
                        .background(badgeColor.copy(alpha = 0.2f), RoundedCornerShape(6.dp))
                        .padding(horizontal = 6.dp, vertical = 3.dp)
                ) {
                    val labelText = when {
                        !item.isPending -> item.status.uppercase()
                        isSpotify -> "SPOTIFY VIP"
                        isCrunchy -> "CRUNCHYROLL"
                        isTv -> "TV SMART"
                        isRecarga -> "RECARGA"
                        else -> "PENDIENTE"
                    }
                    Text(
                        text = labelText,
                        color = badgeColor,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Black
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Detalle y Monto
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.Black, RoundedCornerShape(8.dp))
                    .padding(horizontal = 10.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = item.detail,
                    color = CuycitoTextSecondary,
                    fontSize = 11.sp,
                    maxLines = 2
                )
                if (item.amount > 0) {
                    Text(
                        text = "S/ %.2f".format(item.amount),
                        color = CuycitoGold,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black
                    )
                }
            }

            // Datos exclusivos de Spotify (Email, Contraseña y Código OTP 6 dígitos)
            if (isSpotify && (item.spotifyEmail.isNotBlank() || item.spotifyOtpCode.isNotBlank())) {
                Spacer(modifier = Modifier.height(6.dp))
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF0F1B15), RoundedCornerShape(8.dp))
                        .border(1.dp, CuycitoGreen.copy(alpha = 0.4f), RoundedCornerShape(8.dp))
                        .padding(8.dp)
                ) {
                    if (item.spotifyEmail.isNotBlank()) {
                        Text("Cuenta: ${item.spotifyEmail}", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                    if (item.spotifyPassword.isNotBlank()) {
                        Text("Clave: ${item.spotifyPassword}", color = CuycitoGold, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                    }
                    if (item.spotifyOtpCode.isNotBlank()) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(CuycitoGreen.copy(alpha = 0.2f), RoundedCornerShape(6.dp))
                                .padding(vertical = 4.dp, horizontal = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("CODIGO OTP 6 DIGITOS: ${item.spotifyOtpCode}", color = CuycitoGreen, fontSize = 12.sp, fontWeight = FontWeight.Black)
                        }
                    }
                }
            }

            // Botones de accion especificos
            if (item.isPending) {
                Spacer(modifier = Modifier.height(10.dp))

                if (isRecarga) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        if (item.imageUrl.isNotBlank()) {
                            OutlinedButton(
                                onClick = { onViewVoucher(item.imageUrl) },
                                border = androidx.compose.foundation.BorderStroke(1.dp, CuycitoGold),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.weight(1f).height(38.dp)
                            ) {
                                Icon(Icons.Default.Image, contentDescription = null, tint = CuycitoGold, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("VOUCHER", color = CuycitoGold, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                            }
                        }

                        Button(
                            onClick = onApproveRecarga,
                            colors = ButtonDefaults.buttonColors(containerColor = CuycitoGreen),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1.2f).height(38.dp)
                        ) {
                            Icon(Icons.Default.Check, contentDescription = null, tint = Color.Black, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("APROBAR", color = Color.Black, fontSize = 10.sp, fontWeight = FontWeight.Black)
                        }

                        Button(
                            onClick = onRejectRecargaClick,
                            colors = ButtonDefaults.buttonColors(containerColor = CuycitoRed),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f).height(38.dp)
                        ) {
                            Text("RECHAZAR", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                } else if (isSpotify) {
                    Button(
                        onClick = onMarkActivated,
                        colors = ButtonDefaults.buttonColors(containerColor = CuycitoGreen),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth().height(38.dp)
                    ) {
                        Icon(Icons.Default.Check, contentDescription = null, tint = Color.Black, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("ACTIVAR SPOTIFY", color = Color.Black, fontSize = 10.sp, fontWeight = FontWeight.Black)
                    }
                } else if (isCrunchy) {
                    Button(
                        onClick = onMarkActivated,
                        colors = ButtonDefaults.buttonColors(containerColor = CuycitoGold),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth().height(38.dp)
                    ) {
                        Icon(Icons.Default.Check, contentDescription = null, tint = Color.Black, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("ENTREGAR CREDENCIALES CRUNCHYROLL", color = Color.Black, fontSize = 10.sp, fontWeight = FontWeight.Black)
                    }
                } else if (isTv) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        if (item.imageUrl.isNotBlank()) {
                            OutlinedButton(
                                onClick = { onViewQr(item.imageUrl) },
                                border = androidx.compose.foundation.BorderStroke(1.dp, CuycitoCyan),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.weight(1f).height(38.dp)
                            ) {
                                Icon(Icons.Default.QrCode, contentDescription = null, tint = CuycitoCyan, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("VER QR", color = CuycitoCyan, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                            }
                        }

                        Button(
                            onClick = onMarkActivated,
                            colors = ButtonDefaults.buttonColors(containerColor = CuycitoGreen),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1.2f).height(38.dp)
                        ) {
                            Icon(Icons.Default.Check, contentDescription = null, tint = Color.Black, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("ACTIVAR TV", color = Color.Black, fontSize = 10.sp, fontWeight = FontWeight.Black)
                        }
                    }
                } else {
                    Button(
                        onClick = onMarkActivated,
                        colors = ButtonDefaults.buttonColors(containerColor = CuycitoGreen),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth().height(38.dp)
                    ) {
                        Icon(Icons.Default.Check, contentDescription = null, tint = Color.Black, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("MARCAR COMO ATENDIDO", color = Color.Black, fontSize = 10.sp, fontWeight = FontWeight.Black)
                    }
                }
            }
        }
    }
}
