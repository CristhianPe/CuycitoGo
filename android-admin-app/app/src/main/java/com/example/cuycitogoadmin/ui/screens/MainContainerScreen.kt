package com.example.cuycitogoadmin.ui.screens
import kotlinx.coroutines.launch

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
    ALARMAS("Alarmas"),
    RECARGAS("Recargas"),
    TV_ACTIVATIONS("Activacion TV"),
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
    var currentTab by remember { mutableStateOf(AdminTab.ALARMAS) }
    var soundEnabled by remember { mutableStateOf(true) }

    // State collections en tiempo real
    val liveAlarms by firebaseManager.getLiveAlarmsFlow().collectAsState(initial = emptyList())
    val recargas by firebaseManager.getRecargasFlow().collectAsState(initial = emptyList())
    val tvActivations by firebaseManager.getTvActivationsFlow().collectAsState(initial = emptyList())
    val clients by firebaseManager.getClientsFlow().collectAsState(initial = emptyList())
    val catalog by firebaseManager.getCatalogFlow().collectAsState(initial = emptyList())
    val isStoreMaintenance by firebaseManager.getStoreMaintenanceFlow().collectAsState(initial = false)
    val scope = rememberCoroutineScope()

    // Contadores de pendientes
    val totalPendingAlarms = remember(liveAlarms) {
        liveAlarms.count { it.isPending }
    }
    val pendingRecargasCount = remember(recargas) {
        recargas.count { it.status.equals("pending", ignoreCase = true) }
    }
    val pendingTvCount = remember(tvActivations) {
        tvActivations.count { it.status.contains("Pendiente", ignoreCase = true) }
    }

    // Monitoreo reactivo de nuevas alertas con audio y vibración
    var lastPendingAlarmsCount by remember { mutableStateOf(-1) }

    LaunchedEffect(totalPendingAlarms) {
        if (lastPendingAlarmsCount in 0 until totalPendingAlarms && soundEnabled) {
            soundManager.playRecargaAlert()
        }
        lastPendingAlarmsCount = totalPendingAlarms
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
                    // Boton silenciar / activar alarmas
                    IconButton(onClick = { soundEnabled = !soundEnabled }) {
                        Icon(
                            imageVector = if (soundEnabled) Icons.Default.NotificationsActive else Icons.Default.NotificationsOff,
                            contentDescription = "Alarma",
                            tint = if (soundEnabled) CuycitoGold else CuycitoTextSecondary
                        )
                    }

                    // Boton Cerrar Sesion
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
                // Tab 1: Widget de Alarmas & Radar Principal
                NavigationBarItem(
                    selected = currentTab == AdminTab.ALARMAS,
                    onClick = { currentTab = AdminTab.ALARMAS },
                    icon = {
                        BadgedBox(badge = {
                            if (totalPendingAlarms > 0) {
                                Badge(containerColor = CuycitoRed) {
                                    Text("$totalPendingAlarms", color = Color.White, fontWeight = FontWeight.Black)
                                }
                            }
                        }) {
                            Icon(Icons.Default.Radar, contentDescription = "Alarmas")
                        }
                    },
                    label = { Text("Alarmas", fontSize = 10.sp, fontWeight = FontWeight.Bold) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = CuycitoGold,
                        selectedTextColor = CuycitoGold,
                        indicatorColor = Color.Black,
                        unselectedIconColor = CuycitoTextSecondary,
                        unselectedTextColor = CuycitoTextSecondary
                    )
                )

                // Tab 2: Recargas
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
                    label = { Text("Recargas", fontSize = 10.sp, fontWeight = FontWeight.Bold) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = CuycitoGold,
                        selectedTextColor = CuycitoGold,
                        indicatorColor = Color.Black,
                        unselectedIconColor = CuycitoTextSecondary,
                        unselectedTextColor = CuycitoTextSecondary
                    )
                )

                // Tab 3: Activacion TV
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
                    label = { Text("TV QR", fontSize = 10.sp, fontWeight = FontWeight.Bold) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = CuycitoCyan,
                        selectedTextColor = CuycitoCyan,
                        indicatorColor = Color.Black,
                        unselectedIconColor = CuycitoTextSecondary,
                        unselectedTextColor = CuycitoTextSecondary
                    )
                )

                // Tab 4: Clientes
                NavigationBarItem(
                    selected = currentTab == AdminTab.CLIENTES,
                    onClick = { currentTab = AdminTab.CLIENTES },
                    icon = {
                        Icon(Icons.Default.People, contentDescription = "Clientes")
                    },
                    label = { Text("Clientes", fontSize = 10.sp, fontWeight = FontWeight.Bold) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = CuycitoGold,
                        selectedTextColor = CuycitoGold,
                        indicatorColor = Color.Black,
                        unselectedIconColor = CuycitoTextSecondary,
                        unselectedTextColor = CuycitoTextSecondary
                    )
                )

                // Tab 5: Tienda
                NavigationBarItem(
                    selected = currentTab == AdminTab.TIENDA,
                    onClick = { currentTab = AdminTab.TIENDA },
                    icon = {
                        Icon(Icons.Default.Store, contentDescription = "Tienda")
                    },
                    label = { Text("Tienda", fontSize = 10.sp, fontWeight = FontWeight.Bold) },
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
                AdminTab.ALARMAS -> AlarmsScreen(
                    alarms = liveAlarms,
                    onApproveRecarga = { firebaseManager.approveRecarga(it) },
                    onRejectRecarga = { id, reason -> firebaseManager.rejectRecarga(id, reason) },
                    onMarkTvActivated = { firebaseManager.markTvActivated(it) }
                )
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
                AdminTab.TIENDA -> TiendaScreen(products = catalog, isMaintenance = isStoreMaintenance, onToggleMaintenance = { isM -> scope.launch { firebaseManager.setStoreMaintenance(isM) } })
            }
        }
    }
}



