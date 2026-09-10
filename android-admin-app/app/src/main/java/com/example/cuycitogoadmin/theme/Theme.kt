package com.example.cuycitogoadmin.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext

private val CuycitoColorScheme = darkColorScheme(
    primary = CuycitoGold,
    onPrimary = CuycitoBlack,
    primaryContainer = CuycitoDarkCard,
    onPrimaryContainer = CuycitoGold,
    secondary = CuycitoCyan,
    onSecondary = CuycitoBlack,
    tertiary = CuycitoRed,
    onTertiary = CuycitoTextPrimary,
    background = CuycitoBlack,
    onBackground = CuycitoTextPrimary,
    surface = CuycitoDarkCard,
    onSurface = CuycitoTextPrimary,
    surfaceVariant = CuycitoCardElevated,
    onSurfaceVariant = CuycitoTextSecondary,
    outline = CuycitoBorder
)

@Composable
fun CuycitoGoAdminTheme(
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = CuycitoColorScheme,
        typography = Typography,
        content = content
    )
}
