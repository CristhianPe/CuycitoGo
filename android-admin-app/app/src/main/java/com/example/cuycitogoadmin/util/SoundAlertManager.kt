package com.example.cuycitogoadmin.util

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class SoundAlertManager(private val context: Context) {

    private var toneGenerator: ToneGenerator? = null
    private val vibrator: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
        vibratorManager?.defaultVibrator
    } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }

    init {
        try {
            toneGenerator = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 100)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun playRecargaAlert() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                // Tono alegre de cobro / dinero (doble beep agudo)
                toneGenerator?.startTone(ToneGenerator.TONE_PROP_BEEP2, 350)
                vibratePattern(longArrayOf(0, 150, 100, 250))
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun playTvActivationAlert() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                // Tono de alerta de TV (beep sostenido)
                toneGenerator?.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 400)
                vibratePattern(longArrayOf(0, 300, 150, 300))
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun playNewClientAlert() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                // Tono de bienvenida
                toneGenerator?.startTone(ToneGenerator.TONE_PROP_ACK, 250)
                vibratePattern(longArrayOf(0, 200))
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun vibratePattern(timings: LongArray) {
        try {
            vibrator?.let { v ->
                if (v.hasVibrator()) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        v.vibrate(VibrationEffect.createWaveform(timings, -1))
                    } else {
                        @Suppress("DEPRECATION")
                        v.vibrate(timings, -1)
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
