package com.example.cuycitogoadmin.ui.screens

import android.widget.Toast
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import coil.compose.AsyncImage
import com.example.cuycitogoadmin.data.model.RecargaModel
import com.example.cuycitogoadmin.theme.*
import kotlinx.coroutines.launch

@Composable
fun RecargasScreen(
    recargas: List<RecargaModel>,
    onApproveRecarga: suspend (RecargaModel) -> Result<Boolean>,
    onRejectRecarga: suspend (String, String) -> Result<Boolean>
) {
    var filterStatus by remember { mutableStateOf("pending") } // pending, approved, all
    var selectedVoucherUrl by remember { mutableStateOf<String?>(null) }
    var recargaToReject by remember { mutableStateOf<RecargaModel?>(null) }
    var rejectReason by remember { mutableStateOf("Comprobante ilegible / no v�lido") }
    var isProcessing by remember { mutableStateOf(false) }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val isPendingStatus = { status: String ->
        val s = status.lowercase()
        s.contains("pending") || s.contains("manual") || s.contains("pendiente") || s.contains("wait")
    }

    val filteredList = remember(recargas, filterStatus) {
        when (filterStatus) {
            "pending" -> recargas.filter { isPendingStatus(it.status) }
            "approved" -> recargas.filter { it.status.contains("approved", ignoreCase = true) || it.status.contains("aprobad", ignoreCase = true) }
            else -> recargas
        }
    }

    val pendingCount = remember(recargas) {
        recargas.count { isPendingStatus(it.status) }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CuycitoBlack)
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        // Selector de Filtros
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(
                selected = filterStatus == "pending",
                onClick = { filterStatus = "pending" },
                label = {
                    Text(
                        "Pendientes ($pendingCount)",
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp
                    )
                },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = CuycitoGold,
                    selectedLabelColor = CuycitoBlack,
                    containerColor = CuycitoDarkCard,
                    labelColor = CuycitoTextSecondary
                ),
                border = FilterChipDefaults.filterChipBorder(
                    borderColor = if (filterStatus == "pending") CuycitoGold else CuycitoBorder,
                    enabled = true,
                    selected = filterStatus == "pending"
                )
            )

            FilterChip(
                selected = filterStatus == "approved",
                onClick = { filterStatus = "approved" },
                label = {
                    Text(
                        "Aprobadas",
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp
                    )
                },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = CuycitoGreen,
                    selectedLabelColor = CuycitoBlack,
                    containerColor = CuycitoDarkCard,
                    labelColor = CuycitoTextSecondary
                )
            )

            FilterChip(
                selected = filterStatus == "all",
                onClick = { filterStatus = "all" },
                label = {
                    Text(
                        "Todas (${recargas.size})",
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp
                    )
                },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = CuycitoDarkCard,
                    selectedLabelColor = Color.White,
                    containerColor = Color.Black,
                    labelColor = CuycitoTextSecondary
                )
            )
        }

        if (filteredList.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = CuycitoGreen,
                        modifier = Modifier.size(54.dp)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = if (filterStatus == "pending") "�Al d�a! No hay recargas pendientes." else "No hay recargas en esta lista.",
                        color = CuycitoTextSecondary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(filteredList, key = { it.id }) { item ->
                    RecargaCard(
                        item = item,
                        onViewVoucher = {
                            if (item.voucherUrl.isNotBlank()) {
                                selectedVoucherUrl = item.voucherUrl
                            } else {
                                Toast.makeText(context, "No se adjunt� imagen de voucher", Toast.LENGTH_SHORT).show()
                            }
                        },
                        onApprove = {
                            isProcessing = true
                            scope.launch {
                                val res = onApproveRecarga(item)
                                isProcessing = false
                                if (res.isSuccess) {
                                    Toast.makeText(context, "? Saldo de S/ ${item.amount} acreditado a ${item.clientName}", Toast.LENGTH_LONG).show()
                                } else {
                                    Toast.makeText(context, "? Error al aprobar: ${res.exceptionOrNull()?.message}", Toast.LENGTH_LONG).show()
                                }
                            }
                        },
                        onReject = {
                            recargaToReject = item
                        }
                    )
                }
            }
        }
    }

    // Modal Visor de Voucher
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
                        Text(
                            "Comprobante de Pago",
                            color = CuycitoGold,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                        IconButton(onClick = { selectedVoucherUrl = null }) {
                            Icon(Icons.Default.Close, contentDescription = null, tint = Color.White)
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    AsyncImage(
                        model = selectedVoucherUrl,
                        contentDescription = "Voucher de Pago",
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 420.dp)
                            .clip(RoundedCornerShape(12.dp)),
                        contentScale = ContentScale.Fit
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Button(
                        onClick = { selectedVoucherUrl = null },
                        colors = ButtonDefaults.buttonColors(containerColor = CuycitoDarkCard),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Cerrar Visor", color = Color.White)
                    }
                }
            }
        }
    }

    // Modal Rechazo de Recarga
    if (recargaToReject != null) {
        AlertDialog(
            onDismissRequest = { recargaToReject = null },
            title = { Text("Rechazar Recarga de S/ ${recargaToReject?.amount}", color = CuycitoRed, fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    Text("Indica el motivo de rechazo:", color = CuycitoTextSecondary, fontSize = 12.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = rejectReason,
                        onValueChange = { rejectReason = it },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = CuycitoRed,
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White
                        )
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val item = recargaToReject ?: return@Button
                        recargaToReject = null
                        scope.launch {
                            onRejectRecarga(item.id, rejectReason)
                            Toast.makeText(context, "?? Recarga rechazada", Toast.LENGTH_SHORT).show()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CuycitoRed)
                ) {
                    Text("Confirmar Rechazo", color = Color.White, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { recargaToReject = null }) {
                    Text("Cancelar", color = CuycitoTextSecondary)
                }
            },
            containerColor = CuycitoDarkCard
        )
    }
}

@Composable
fun RecargaCard(
    item: RecargaModel,
    onViewVoucher: () -> Unit,
    onApprove: () -> Unit,
    onReject: () -> Unit
) {
    val s = item.status.lowercase()
    val isPending = s.contains("pending") || s.contains("manual") || s.contains("pendiente") || s.contains("wait")
    val isApproved = s.contains("approved") || s.contains("aprobad")

    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = CuycitoDarkCard),
        border = CardDefaults.outlinedCardBorder().copy(
            brush = androidx.compose.ui.graphics.SolidColor(if (isPending) CuycitoGold else CuycitoBorder)
        ),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header: Cliente & Monto
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = item.clientName.ifBlank { "Cliente VIP" },
                        color = Color.White,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = item.clientEmail.ifBlank { "Sin correo" },
                        color = CuycitoTextSecondary,
                        fontSize = 11.sp
                    )
                }

                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "S/ %.2f".format(item.amount),
                        color = CuycitoGold,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black
                    )
                    Text(
                        text = item.paymentMethod.uppercase(),
                        color = CuycitoCyan,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Datos Extra y Voucher
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Estado Badge
                val (badgeBg, badgeText, badgeColor) = when {
                    isPending -> Triple(Color(0xFF422006), "PENDIENTE", CuycitoGold)
                    isApproved -> Triple(Color(0xFF064E3B), "APROBADO", CuycitoGreen)
                    else -> Triple(Color(0xFF450A0A), "RECHAZADO", CuycitoRed)
                }

                Box(
                    modifier = Modifier
                        .background(badgeBg, RoundedCornerShape(8.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = badgeText,
                        color = badgeColor,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black
                    )
                }

                // Bot�n Ver Comprobante
                if (item.voucherUrl.isNotBlank()) {
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color.Black)
                            .clickable { onViewVoucher() }
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.Image, contentDescription = null, tint = CuycitoGold, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Ver Comprobante", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            // Acciones para estado Pendiente
            if (isPending) {
                Spacer(modifier = Modifier.height(14.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = onApprove,
                        colors = ButtonDefaults.buttonColors(containerColor = CuycitoGreen),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f).height(42.dp)
                    ) {
                        Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("APROBAR", fontWeight = FontWeight.Black, fontSize = 12.sp, color = Color.Black)
                    }

                    Button(
                        onClick = onReject,
                        colors = ButtonDefaults.buttonColors(containerColor = CuycitoRed),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f).height(42.dp)
                    ) {
                        Icon(Icons.Default.Close, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("RECHAZAR", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Color.White)
                    }
                }
            }
        }
    }
}
