Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectRoot = Resolve-Path "$scriptPath\.."
$backendPath = "$projectRoot\backend"

[xml]$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="🐹 CuycitoGO • Centro de Control del Servidor" 
        Height="560" Width="680" 
        WindowStartupLocation="CenterScreen" 
        ResizeMode="CanMinimize"
        Background="#0d0d0d" 
        Foreground="#f3f4f6"
        FontFamily="Segoe UI">
    <Grid Margin="20">
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
            <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>

        <!-- Cabecera -->
        <Border Grid.Row="0" Background="#141414" BorderBrush="#333333" BorderThickness="1" CornerRadius="12" Padding="15" Margin="0,0,0,15">
            <Grid>
                <Grid.ColumnDefinitions>
                    <ColumnDefinition Width="*"/>
                    <ColumnDefinition Width="Auto"/>
                </Grid.ColumnDefinitions>
                <StackPanel Grid.Column="0">
                    <TextBlock Text="🐹 CuycitoGO Server &amp; IMAP Lemon Cash" FontSize="18" FontWeight="Black" Foreground="#eab308"/>
                    <TextBlock Text="Control del robot de recargas y servidor API en tiempo real" FontSize="11" Foreground="#9ca3af" Margin="0,3,0,0"/>
                </StackPanel>
                <Border Grid.Column="1" x:Name="StatusBadge" Background="#3b0764" BorderBrush="#a855f7" BorderThickness="1" CornerRadius="8" Padding="10,5">
                    <TextBlock x:Name="StatusText" Text="🔴 DETENIDO" FontWeight="Bold" FontSize="12" Foreground="#f87171" HorizontalAlignment="Center"/>
                </Border>
            </Grid>
        </Border>

        <!-- Panel de Botones de Control (Prendido / Apagado) -->
        <Grid Grid.Row="1" Margin="0,0,0,15">
            <Grid.ColumnDefinitions>
                <ColumnDefinition Width="*"/>
                <ColumnDefinition Width="*"/>
            </Grid.ColumnDefinitions>

            <!-- Boton Encender -->
            <Button Grid.Column="0" x:Name="BtnStart" Margin="0,0,8,0" Height="50" Cursor="Hand" Background="#065f46" BorderBrush="#10b981" BorderThickness="1.5">
                <Button.Resources>
                    <Style TargetType="Border">
                        <Setter Property="CornerRadius" Value="10"/>
                    </Style>
                </Button.Resources>
                <StackPanel Orientation="Horizontal">
                    <TextBlock Text="🟢" FontSize="16" Margin="0,0,8,0" VerticalAlignment="Center"/>
                    <TextBlock Text="ENCENDER SERVIDOR" FontWeight="Black" FontSize="13" Foreground="#ffffff" VerticalAlignment="Center"/>
                </StackPanel>
            </Button>

            <!-- Boton Apagar -->
            <Button Grid.Column="1" x:Name="BtnStop" Margin="8,0,0,0" Height="50" Cursor="Hand" Background="#7f1d1d" BorderBrush="#ef4444" BorderThickness="1.5" IsEnabled="False">
                <Button.Resources>
                    <Style TargetType="Border">
                        <Setter Property="CornerRadius" Value="10"/>
                    </Style>
                </Button.Resources>
                <StackPanel Orientation="Horizontal">
                    <TextBlock Text="🔴" FontSize="16" Margin="0,0,8,0" VerticalAlignment="Center"/>
                    <TextBlock Text="APAGAR SERVIDOR" FontWeight="Black" FontSize="13" Foreground="#ffffff" VerticalAlignment="Center"/>
                </StackPanel>
            </Button>
        </Grid>

        <!-- Consola de Logs en Vivo -->
        <Border Grid.Row="2" Background="#080808" BorderBrush="#262626" BorderThickness="1" CornerRadius="10" Padding="12" Margin="0,0,0,15">
            <Grid>
                <Grid.RowDefinitions>
                    <RowDefinition Height="Auto"/>
                    <RowDefinition Height="*"/>
                </Grid.RowDefinitions>
                <TextBlock Grid.Row="0" Text="📜 REGISTRO DE ACTIVIDAD &amp; CORREOS EN VIVO:" FontSize="10" FontWeight="Bold" Foreground="#6b7280" Margin="0,0,0,8"/>
                <TextBox Grid.Row="1" x:Name="TxtLogs" Background="Transparent" Foreground="#4ade80" FontFamily="Consolas" FontSize="11" 
                         IsReadOnly="True" TextWrapping="Wrap" VerticalScrollBarVisibility="Auto" BorderThickness="0"/>
            </Grid>
        </Border>

        <!-- Accesos Rápidos & Footer -->
        <Grid Grid.Row="3">
            <Grid.ColumnDefinitions>
                <ColumnDefinition Width="Auto"/>
                <ColumnDefinition Width="*"/>
                <ColumnDefinition Width="Auto"/>
            </Grid.ColumnDefinitions>

            <StackPanel Grid.Column="0" Orientation="Horizontal">
                <Button x:Name="BtnOpenDashboard" Content="👑 Dashboard" Height="32" Width="105" Margin="0,0,6,0" Cursor="Hand" Background="#171717" BorderBrush="#404040" Foreground="#e5e7eb" FontWeight="Bold" FontSize="11"/>
                <Button x:Name="BtnOpenStore" Content="🛒 Tienda Web" Height="32" Width="105" Margin="0,0,6,0" Cursor="Hand" Background="#171717" BorderBrush="#404040" Foreground="#e5e7eb" FontWeight="Bold" FontSize="11"/>
                <Button x:Name="BtnOpenProfile" Content="👤 Mi Perfil" Height="32" Width="95" Cursor="Hand" Background="#171717" BorderBrush="#404040" Foreground="#e5e7eb" FontWeight="Bold" FontSize="11"/>
            </StackPanel>

            <TextBlock Grid.Column="2" Text="Puerto: 5000 | IMAP: Activo" FontSize="11" Foreground="#6b7280" VerticalAlignment="Center"/>
        </Grid>
    </Grid>
</Window>
"@

$reader = (New-Object System.Xml.XmlNodeReader $xaml)
$window = [Windows.Markup.XamlReader]::Load($reader)

# Elementos del UI
$btnStart = $window.FindName("BtnStart")
$btnStop = $window.FindName("BtnStop")
$statusBadge = $window.FindName("StatusBadge")
$statusText = $window.FindName("StatusText")
$txtLogs = $window.FindName("TxtLogs")
$btnOpenDashboard = $window.FindName("BtnOpenDashboard")
$btnOpenStore = $window.FindName("BtnOpenStore")
$btnOpenProfile = $window.FindName("BtnOpenProfile")

$global:serverProcess = $null

function Append-Log($message) {
    $time = (Get-Date).ToString("HH:mm:ss")
    $logLine = "[$time] $message`r`n"
    $window.Dispatcher.Invoke([Action]{
        $txtLogs.AppendText($logLine)
        $txtLogs.ScrollToEnd()
    })
}

function Start-ServerInstance {
    if ($global:serverProcess -and -not $global:serverProcess.HasExited) {
        return
    }

    Append-Log "🚀 Iniciando servidor backend Node.js en puerto 5000..."
    
    $pinfo = New-Object System.Diagnostics.ProcessStartInfo
    $pinfo.FileName = "node.exe"
    $pinfo.Arguments = "server.js"
    $pinfo.WorkingDirectory = $backendPath
    $pinfo.RedirectStandardOutput = $true
    $pinfo.RedirectStandardError = $true
    $pinfo.UseShellExecute = $false
    $pinfo.CreateNoWindow = $true

    $global:serverProcess = New-Object System.Diagnostics.Process
    $global:serverProcess.StartInfo = $pinfo
    $global:serverProcess.EnableRaisingEvents = $true

    # Eventos de lectura de salida en vivo
    Register-ObjectEvent -InputObject $global:serverProcess -EventName OutputDataReceived -Action {
        if ($EventArgs.Data) {
            Append-Log $EventArgs.Data
        }
    } | Out-Null

    Register-ObjectEvent -InputObject $global:serverProcess -EventName ErrorDataReceived -Action {
        if ($EventArgs.Data) {
            Append-Log "⚠️ $($EventArgs.Data)"
        }
    } | Out-Null

    $global:serverProcess.Start() | Out-Null
    $global:serverProcess.BeginOutputReadLine()
    $global:serverProcess.BeginErrorReadLine()

    $statusText.Text = "🟢 EN LÍNEA"
    $statusText.Foreground = [System.Windows.Media.Brushes]::LimeGreen
    $statusBadge.BorderBrush = [System.Windows.Media.Brushes]::LimeGreen
    $statusBadge.Background = [System.Windows.Media.BrushConverter]::new().ConvertFromString("#064e3b")

    $btnStart.IsEnabled = $false
    $btnStop.IsEnabled = $true
    Append-Log "✅ Servidor activo y escuchando en http://localhost:5000"
    Append-Log "🍋 Lector IMAP Lemon Cash conectado a cmancocambillo@gmail.com"
}

function Stop-ServerInstance {
    if ($global:serverProcess -and -not $global:serverProcess.HasExited) {
        Append-Log "🛑 Deteniendo servidor CuycitoGO..."
        try {
            Stop-Process -Id $global:serverProcess.Id -Force -ErrorAction SilentlyContinue
        } catch {}
    }

    # Asegurar que cualquier proceso node residual en puerto 5000 se libere
    try {
        $portProcess = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
        if ($portProcess) {
            Stop-Process -Id $portProcess.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    } catch {}

    $statusText.Text = "🔴 DETENIDO"
    $statusText.Foreground = [System.Windows.Media.Brushes]::Tomato
    $statusBadge.BorderBrush = [System.Windows.Media.Brushes]::Tomato
    $statusBadge.Background = [System.Windows.Media.BrushConverter]::new().ConvertFromString("#450a0a")

    $btnStart.IsEnabled = $true
    $btnStop.IsEnabled = $false
    Append-Log "💤 Servidor apagado correctamente."
}

# Eventos de Botones
$btnStart.Add_Click({
    Start-ServerInstance
})

$btnStop.Add_Click({
    Stop-ServerInstance
})

$btnOpenDashboard.Add_Click({
    Start-Process "$projectRoot\dashboard.html"
})

$btnOpenStore.Add_Click({
    Start-Process "$projectRoot\index.html"
})

$btnOpenProfile.Add_Click({
    Start-Process "$projectRoot\perfil.html"
})

# Auto-apagar proceso al cerrar la ventana
$window.Add_Closing({
    Stop-ServerInstance
})

Append-Log "🐹 Centro de Control CuycitoGO inicializado."
Append-Log "💡 Presiona 'ENCENDER SERVIDOR' para iniciar la escucha de Lemon Cash."

# Mostrar Ventana
$window.ShowDialog() | Out-Null
