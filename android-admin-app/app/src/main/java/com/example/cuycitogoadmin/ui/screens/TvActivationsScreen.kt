package com.example.cuycitogoadmin.ui.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import com.example.cuycitogoadmin.data.model.TvActivationModel
import com.example.cuycitogoadmin.theme.*
import kotlinx.coroutines.launch

@Composable
fun TvActivationsScreen(
    activations: List<TvActivationModel>,
    onMarkActivated: suspend (String) -> Result<Boolean>
) {
    var selectedQrUrl by remember { mutableStateOf<String?>(null) }
    var selectedActivationTitle by remember { mutableStateOf("") }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val pendingList = remember(activations) {
        activations.filter { it.status.contains("Pendiente", ignoreCase = true) }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CuycitoBlack)
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                "Activaciones de TV (${pendingList.size} en cola)",
                color = CuycitoGold,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        if (pendingList.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Default.Tv,
                        contentDescription = null,
                        tint = CuycitoCyan,
                        modifier = Modifier.size(54.dp)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        "�Sin solicitudes de TV pendientes",
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
                items(pendingList, key = { it.id }) { item ->
                    TvActivationCard(
                        item = item,
                        onViewQr = {
                            if (item.qrImageUrl.isNotBlank()) {
                                selectedQrUrl = item.qrImageUrl
                                selectedActivationTitle = "${item.service} - ${item.person}"
                            } else {
                                Toast.makeText(context, "No hay imagen QR adjunta para este televisor", Toast.LENGTH_SHORT).show()
                            }
                        },
                        onActivate = {
                            scope.launch {
                                val res = onMarkActivated(item.id)
                                if (res.isSuccess) {
                                    Toast.makeText(context, "?? �${item.service} activado con �xito!", Toast.LENGTH_LONG).show()
                                } else {
                                    Toast.makeText(context, "Error: ${res.exceptionOrNull()?.message}", Toast.LENGTH_SHORT).show()
                                }
                            }
                        }
                    )
                }
            }
        }
    }

    // Modal Visor de C�digo QR en Grande / Pantalla Completa
    if (selectedQrUrl != null) {
        Dialog(onDismissRequest = { selectedQrUrl = null }) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .wrapContentHeight()
                    .background(Color.Black, RoundedCornerShape(24.dp))
                    .border(2.dp, CuycitoCyan, RoundedCornerShape(24.dp))
                    .padding(20.dp)
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Escanear C�digo QR",
                            color = CuycitoCyan,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                        IconButton(onClick = { selectedQrUrl = null }) {
                            Icon(Icons.Default.Close, contentDescription = null, tint = Color.White)
                        }
                    }

                    Text(
                        text = selectedActivationTitle,
                        color = CuycitoTextSecondary,
                        fontSize = 12.sp,
                        modifier = Modifier.align(Alignment.Start)
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    // Imagen QR
                    Box(
                        modifier = Modifier
                            .size(280.dp)
                            .background(Color.White, RoundedCornerShape(16.dp))
                            .padding(12.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        AsyncImage(
                            model = selectedQrUrl,
                            contentDescription = "C�digo QR de TV",
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Fit
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "Apunta con la app oficial de tu celular para escanear e iniciar sesi�n.",
                        color = CuycitoTextSecondary,
                        fontSize = 11.sp,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Button(
                        onClick = { selectedQrUrl = null },
                        colors = ButtonDefaults.buttonColors(containerColor = CuycitoDarkCard),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Cerrar Visor QR", color = Color.White)
                    }
                }
            }
        }
    }
}

@Composable
fun TvActivationCard(
    item: TvActivationModel,
    onViewQr: () -> Unit,
    onActivate: () -> Unit
) {
    val sLower = item.service.lowercase()
    val isSpotify = sLower.contains("spotify")
    val isCrunchy = sLower.contains("crunchyroll") || sLower.contains("crunchy")
    val isTv = sLower.contains("netflix") || sLower.contains("disney") || sLower.contains("prime") || sLower.contains("hbo") || sLower.contains("max")

    val cardColor = when {
        isSpotify -> CuycitoGreen
        isCrunchy -> CuycitoGold
        else -> CuycitoCyan
    }

    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = CuycitoDarkCard),
        border = CardDefaults.outlinedCardBorder().copy(
            brush = androidx.compose.ui.graphics.SolidColor(cardColor)
        ),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = when {
                            isSpotify -> Icons.Default.Headphones
                            isCrunchy -> Icons.Default.Movie
                            else -> Icons.Default.Tv
                        },
                        contentDescription = null,
                        tint = cardColor,
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Text(
                            text = item.service,
                            color = Color.White,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Cliente: ${item.person}",
                            color = CuycitoTextSecondary,
                            fontSize = 11.sp
                        )
                    }
                }

                Box(
                    modifier = Modifier
                        .background(cardColor.copy(alpha = 0.2f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = when {
                            isSpotify -> "SPOTIFY VIP"
                            isCrunchy -> "CRUNCHYROLL"
                            else -> "TV SMART"
                        },
                        color = cardColor,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black
                    )
                }
            }

            // Si es TV Smart con PIN
            if (isTv && item.pinCode.isNotBlank()) {
                Spacer(modifier = Modifier.height(10.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color.Black, RoundedCornerShape(10.dp))
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Codigo TV:", color = CuycitoTextSecondary, fontSize = 11.sp)
                    Text(
                        text = item.pinCode,
                        color = CuycitoGold,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = 2.sp
                    )
                }
            }

            // Si es Spotify con datos de acceso y código OTP
            if (isSpotify && (item.spotifyEmail.isNotBlank() || item.spotifyOtpCode.isNotBlank())) {
                Spacer(modifier = Modifier.height(10.dp))
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF0F1B15), RoundedCornerShape(10.dp))
                        .border(1.dp, CuycitoGreen.copy(alpha = 0.3f), RoundedCornerShape(10.dp))
                        .padding(10.dp)
                ) {
                    if (item.spotifyEmail.isNotBlank()) {
                        Text("Correo Spotify: ${item.spotifyEmail}", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                    if (item.spotifyPassword.isNotBlank()) {
                        Text("Clave Spotify: ${item.spotifyPassword}", color = CuycitoGold, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                    if (item.spotifyOtpCode.isNotBlank()) {
                        Spacer(modifier = Modifier.height(6.dp))
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(CuycitoGreen.copy(alpha = 0.25f), RoundedCornerShape(6.dp))
                                .padding(vertical = 6.dp, horizontal = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("CODIGO OTP 6 DIGITOS: ${item.spotifyOtpCode}", color = CuycitoGreen, fontSize = 13.sp, fontWeight = FontWeight.Black)
                        }
                    }
                }
            }

            // Si es Crunchyroll con credenciales
            if (isCrunchy && item.accountEmail.isNotBlank()) {
                Spacer(modifier = Modifier.height(10.dp))
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color.Black, RoundedCornerShape(10.dp))
                        .border(1.dp, CuycitoGold.copy(alpha = 0.3f), RoundedCornerShape(10.dp))
                        .padding(10.dp)
                ) {
                    Text("Cuenta: ${item.accountEmail}", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    if (item.accountPassword.isNotBlank()) {
                        Text("Clave: ${item.accountPassword}", color = CuycitoGold, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Botones de accion
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (isTv && item.qrImageUrl.isNotBlank()) {
                    OutlinedButton(
                        onClick = onViewQr,
                        border = androidx.compose.foundation.BorderStroke(1.dp, CuycitoCyan),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f).height(42.dp)
                    ) {
                        Icon(Icons.Default.QrCode, contentDescription = null, tint = CuycitoCyan, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("VER QR", color = CuycitoCyan, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }

                Button(
                    onClick = onActivate,
                    colors = ButtonDefaults.buttonColors(containerColor = CuycitoGreen),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.weight(1f).height(42.dp)
                ) {
                    Icon(Icons.Default.Check, contentDescription = null, tint = Color.Black, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = when {
                            isSpotify -> "ACTIVAR SPOTIFY"
                            isCrunchy -> "ENTREGAR CUENTA"
                            else -> "ACTIVAR"
                        },
                        color = Color.Black,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black
                    )
                }
            }
        }
    }
}
