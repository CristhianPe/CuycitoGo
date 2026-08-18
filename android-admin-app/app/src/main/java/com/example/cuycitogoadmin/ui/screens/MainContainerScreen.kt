package com.example.cuycitogoadmin.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.cuycitogoadmin.R
import com.example.cuycitogoadmin.data.model.ClientModel
import com.example.cuycitogoadmin.data.model.ProductModel
import com.example.cuycitogoadmin.data.model.RecargaModel
import com.example.cuycitogoadmin.data.model.TvActivationModel
import com.example.cuycitogoadmin.data.repository.FirebaseManager
import com.example.cuycitogoadmin.theme.*
import com.example.cuycitogoadmin.util.SoundAlertManager

enum class AdminTab(val title: String) {
    RECARGAS("Recargas"),
    TV_ACTIVATIONS("Activación TV"),
    CLIENTES("Clientes"),
    TIENDA("Tienda")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainContainerScreen(
    firebaseManager: FirebaseManager,
    onLogout: () -> Unit
) {
    val context = LocalContext.current
    val soundManager = remember { SoundAlertManager(context) }
    var currentTab by remember { mutableStateOf(AdminTab.RECARGAS) }
    var soundEnabled by remember { mutableStateOf(true) }

    // State collections
    val recargas by firebaseManager.getRecargasFlow().collectAsState(initial = emptyList())
    val tvActivations by firebaseManager.getTvActivationsFlow().collectAsState(initial = emptyList())
    val clients by firebaseManager.getClientsFlow().collectAsState(initial = emptyList())
    val catalog by firebaseManager.getCatalogFlow().collectAsState(initial = emptyList())

    // Contadores de pendientes
    val pendingRecargasCount = remember(recargas) {
        recargas.count { it.status.equals("pending", ignoreCase = true) }
    }
    val pendingTvCount = remember(tvActivations) {
        tvActivations.count { it.status.contains("Pendiente", ignoreCase = true) }
    }

    // Monitoreo reactivo de nuevas alertas
    var lastPendingRecargasCount by remember { mutableStateOf(-1) }
    var lastPendingTvCount by remember { mutableStateOf(-1) }

    LaunchedEffect(pendingRecargasCount) {
        if (lastPendingRecargasCount in 0 until pendingRecargasCount && soundEnabled) {
            soundManager.playRecargaAlert()
        }
        lastPendingRecargasCount = pendingRecargasCount
    }

    LaunchedEffect(pendingTvCount) {
        if (lastPendingTvCount in 0 until pendingTvCount && soundEnabled) {
            soundManager.playTvActivationAlert()
        }
        lastPendingTvCount = pendingTvCount
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Image(
                            painter = painterResource(id = R.drawable.logo),
                            contentDescription = "CuycitoGo",
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .border(1.dp, CuycitoGold, RoundedCornerShape(8.dp))
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "CuycitoGO Admin",
                                color = CuycitoGold,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Black
                            )
                            Text(
                                text = firebaseManager.getCurrentUserEmail(),
                                color = CuycitoTextSecondary,
                                fontSize = 10.sp
                            )
                        }
                    }
                },
                actions = {
                    // Botón silenciar / activar alarmas
                    IconButton(onClick = { soundEnabled = !soundEnabled }) {
                        Icon(
                            imageVector = if (soundEnabled) Icons.Default.NotificationsActive else Icons.Default.NotificationsOff,
                            contentDescription = "Alarma",
                            tint = if (soundEnabled) CuycitoGold else CuycitoTextSecondary
                        )
                    }

                    // Botón Cerrar Sesión
                    IconButton(onClick = {
                        firebaseManager.logout()
                        onLogout()
                    }) {
                        Icon(
                            imageVector = Icons.Default.Logout,
                            contentDescription = "Salir",
                            tint = CuycitoRed
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = CuycitoDarkCard,
                    titleContentColor = Color.White
                )
            )
        },
        bottomBar = {
            NavigationBar(
                containerColor = CuycitoDarkCard,
                tonalElevation = 8.dp
            ) {
                // Tab 1: Recargas
                NavigationBarItem(
                    selected = currentTab == AdminTab.RECARGAS,
                    onClick = { currentTab = AdminTab.RECARGAS },
                    icon = {
                        BadgedBox(badge = {
                            if (pendingRecargasCount > 0) {
                                Badge(containerColor = CuycitoRed) {
                                    Text("$pendingRecargasCount", color = Color.White, fontWeight = FontWeight.Bold)
                                }
                            }
                        }) {
                            Icon(Icons.Default.AccountBalanceWallet, contentDescription = "Recargas")
                        }
                    },
                    label = { Text("Recargas", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = CuycitoGold,
                        selectedTextColor = CuycitoGold,
                        indicatorColor = Color.Black,
                        unselectedIconColor = CuycitoTextSecondary,
                        unselectedTextColor = CuycitoTextSecondary
                    )
                )

                // Tab 2: Activación TV
                NavigationBarItem(
                    selected = currentTab == AdminTab.TV_ACTIVATIONS,
                    onClick = { currentTab = AdminTab.TV_ACTIVATIONS },
                    icon = {
                        BadgedBox(badge = {
                            if (pendingTvCount > 0) {
                                Badge(containerColor = CuycitoCyan) {
                                    Text("$pendingTvCount", color = Color.Black, fontWeight = FontWeight.Black)
                                }
                            }
                        }) {
                            Icon(Icons.Default.Tv, contentDescription = "TV")
                        }
                    },
                    label = { Text("TV QR", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = CuycitoCyan,
                        selectedTextColor = CuycitoCyan,
                        indicatorColor = Color.Black,
                        unselectedIconColor = CuycitoTextSecondary,
                        unselectedTextColor = CuycitoTextSecondary
                    )
                )

                // Tab 3: Clientes
                NavigationBarItem(
                    selected = currentTab == AdminTab.CLIENTES,
                    onClick = { currentTab = AdminTab.CLIENTES },
                    icon = {
                        Icon(Icons.Default.People, contentDescription = "Clientes")
                    },
                    label = { Text("Clientes", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = CuycitoGold,
                        selectedTextColor = CuycitoGold,
                        indicatorColor = Color.Black,
                        unselectedIconColor = CuycitoTextSecondary,
                        unselectedTextColor = CuycitoTextSecondary
                    )
                )

                // Tab 4: Tienda
                NavigationBarItem(
                    selected = currentTab == AdminTab.TIENDA,
                    onClick = { currentTab = AdminTab.TIENDA },
                    icon = {
                        Icon(Icons.Default.Store, contentDescription = "Tienda")
                    },
                    label = { Text("Tienda", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = CuycitoGold,
                        selectedTextColor = CuycitoGold,
                        indicatorColor = Color.Black,
                        unselectedIconColor = CuycitoTextSecondary,
                        unselectedTextColor = CuycitoTextSecondary
                    )
                )
            }
        },
        containerColor = CuycitoBlack
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (currentTab) {
                AdminTab.RECARGAS -> RecargasScreen(
                    recargas = recargas,
                    onApproveRecarga = { firebaseManager.approveRecarga(it) },
                    onRejectRecarga = { id, reason -> firebaseManager.rejectRecarga(id, reason) }
                )
                AdminTab.TV_ACTIVATIONS -> TvActivationsScreen(
                    activations = tvActivations,
                    onMarkActivated = { firebaseManager.markTvActivated(it) }
                )
                AdminTab.CLIENTES -> ClientesScreen(clients = clients)
                AdminTab.TIENDA -> TiendaScreen(products = catalog)
            }
        }
    }
}
