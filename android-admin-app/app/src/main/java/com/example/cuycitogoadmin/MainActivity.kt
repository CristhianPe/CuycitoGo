package com.example.cuycitogoadmin

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.example.cuycitogoadmin.data.repository.FirebaseManager
import com.example.cuycitogoadmin.theme.CuycitoBlack
import com.example.cuycitogoadmin.theme.CuycitoGoAdminTheme
import com.example.cuycitogoadmin.ui.screens.LoginScreen
import com.example.cuycitogoadmin.ui.screens.MainContainerScreen

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val firebaseManager = FirebaseManager(applicationContext)

        setContent {
            CuycitoGoAdminTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = CuycitoBlack
                ) {
                    var isLoggedIn by remember { mutableStateOf(firebaseManager.isUserLoggedIn()) }

                    if (isLoggedIn) {
                        MainContainerScreen(
                            firebaseManager = firebaseManager,
                            onLogout = { isLoggedIn = false }
                        )
                    } else {
                        LoginScreen(
                            onLoginSuccess = { isLoggedIn = true },
                            onLoginClick = { email, pass ->
                                firebaseManager.loginAdmin(email, pass)
                            }
                        )
                    }
                }
            }
        }
    }
}
