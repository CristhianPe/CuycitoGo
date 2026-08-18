package com.example.cuycitogoadmin.ui.screens

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.cuycitogoadmin.data.model.ClientModel
import com.example.cuycitogoadmin.theme.*

@Composable
fun ClientesScreen(clients: List<ClientModel>) {
    var searchQuery by remember { mutableStateOf("") }
    val context = LocalContext.current

    val filteredClients = remember(clients, searchQuery) {
        if (searchQuery.isBlank()) {
            clients
        } else {
            clients.filter {
                it.name.contains(searchQuery, ignoreCase = true) ||
                it.email.contains(searchQuery, ignoreCase = true) ||
                it.phone.contains(searchQuery, ignoreCase = true)
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CuycitoBlack)
            .padding(16.dp)
    ) {
        // Buscador de Clientes
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("Buscar cliente por nombre o correo...", color = CuycitoTextSecondary, fontSize = 13.sp) },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = CuycitoGold) },
            trailingIcon = {
                if (searchQuery.isNotBlank()) {
                    IconButton(onClick = { searchQuery = "" }) {
                        Icon(Icons.Default.Clear, contentDescription = null, tint = Color.White)
                    }
                }
            },
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = CuycitoGold,
                unfocusedBorderColor = CuycitoBorder,
                focusedTextColor = Color.White,
                unfocusedTextColor = Color.White,
                focusedContainerColor = CuycitoDarkCard,
                unfocusedContainerColor = CuycitoDarkCard
            ),
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(14.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                "Clientes Registrados (${filteredClients.size})",
                color = CuycitoGold,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        if (filteredClients.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Text("No se encontraron clientes", color = CuycitoTextSecondary, fontSize = 13.sp)
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(filteredClients, key = { it.id }) { client ->
                    ClientCard(
                        client = client,
                        onOpenWhatsApp = {
                            val phoneClean = client.phone.replace(Regex("[^0-9]"), "")
                            if (phoneClean.isNotBlank()) {
                                try {
                                    val fullNumber = if (phoneClean.startsWith("51")) phoneClean else "51$phoneClean"
                                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$fullNumber"))
                                    context.startActivity(intent)
                                } catch (e: Exception) {
                                    Toast.makeText(context, "No se pudo abrir WhatsApp", Toast.LENGTH_SHORT).show()
                                }
                            } else {
                                Toast.makeText(context, "Cliente sin teléfono registrado", Toast.LENGTH_SHORT).show()
                            }
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun ClientCard(
    client: ClientModel,
    onOpenWhatsApp: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = CuycitoDarkCard),
        border = CardDefaults.outlinedCardBorder().copy(
            brush = androidx.compose.ui.graphics.SolidColor(CuycitoBorder)
        ),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .background(Color.Black, CircleShape)
                        .border(1.dp, CuycitoGold, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = client.name.take(1).uppercase().ifBlank { "C" },
                        color = CuycitoGold,
                        fontWeight = FontWeight.Black,
                        fontSize = 16.sp
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column {
                    Text(
                        text = client.name.ifBlank { "Cliente VIP" },
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = client.email.ifBlank { "Sin correo" },
                        color = CuycitoTextSecondary,
                        fontSize = 11.sp
                    )
                    Text(
                        text = "Saldo: S/ %.2f".format(client.balance),
                        color = if (client.balance > 0) CuycitoGreen else CuycitoTextSecondary,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            IconButton(
                onClick = onOpenWhatsApp,
                modifier = Modifier
                    .background(Color(0xFF064E3B), CircleShape)
                    .size(38.dp)
            ) {
                Icon(
                    Icons.Default.Chat,
                    contentDescription = "WhatsApp",
                    tint = CuycitoGreen,
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}
