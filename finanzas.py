import tkinter as tk
from tkinter import ttk, messagebox
import json
import os
import requests
import datetime
import subprocess
import threading
import sys

# Configuration Constants
FIREBASE_API_KEY = "AIzaSyC-_c45ORNlmAT3dlGOBXjOjkwrT6yx5F4"
FIREBASE_PROJECT_ID = "cuycitogo-app"
CONFIG_FILE = os.path.expanduser("~/.finanzas_config.json")
PERSONAL_FILE = os.path.expanduser("~/.finanzas_personal_expenses.json")
DEBUG_FILE = os.path.expanduser("~/.finanzas_debug.log")
EXCHANGE_RATE = 3.75  # Default USD to PEN exchange rate

# Safe logging to prevent PyInstaller --noconsole print crash
def safe_log(message):
    try:
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(DEBUG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[{timestamp}] {message}\n")
    except:
        pass
    if sys.stdout is not None:
        try:
            print(message)
        except:
            pass

class FinanzasApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Finanzas")
        self.root.geometry("1100x700")
        self.root.minsize(950, 600)
        self.root.configure(bg="#121212")

        # Set app icon if available
        self.logo_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "assets", "img", "logo.png"))
        if os.path.exists(self.logo_path):
            try:
                self.img = tk.PhotoImage(file=self.logo_path)
                self.root.iconphoto(False, self.img)
            except Exception as e:
                safe_log(f"Could not load icon: {e}")

        # State Variables
        self.firebase_token = None
        self.cuycito_transactions = []
        self.personal_transactions = []
        self.filtered_cuycito = []
        self.filtered_personal = []
        
        # Load local configurations
        self.config = self.load_config()
        self.personal_transactions = self.load_personal_transactions()

        # Date Filter State (Default to current local month and year)
        now = datetime.date.today()
        self.months_map = {
            "Enero": "01", "Febrero": "02", "Marzo": "03", "Abril": "04",
            "Mayo": "05", "Junio": "06", "Julio": "07", "Agosto": "08",
            "Septiembre": "09", "Octubre": "10", "Noviembre": "11", "Diciembre": "12"
        }
        inverse_months_map = {v: k for k, v in self.months_map.items()}
        current_month_str = inverse_months_map.get(str(now.month).zfill(2), "Agosto")
        current_year_str = str(now.year)

        self.current_month = tk.StringVar(value=current_month_str)
        self.current_year = tk.StringVar(value=current_year_str)
        self.show_processed_var = tk.BooleanVar(value=False)

        # Initialize Styles
        self.setup_styles()

        # Main Layout Containers
        self.login_frame = None
        self.main_container = None
        
        # Start screen
        self.show_login_screen()

    # -------------------------------------------------------------
    # STYLING
    # -------------------------------------------------------------
    def setup_styles(self):
        self.style = ttk.Style()
        self.style.theme_use("clam")
        
        bg_dark = "#121212"
        bg_card = "#1e1e1e"
        accent_gold = "#ffb703"
        text_white = "#ffffff"
        
        # Treeview styling
        self.style.configure("Treeview", 
                             background=bg_card, 
                             foreground=text_white, 
                             fieldbackground=bg_card,
                             rowheight=28,
                             borderwidth=0,
                             font=("Segoe UI", 10))
        self.style.map("Treeview", 
                       background=[("selected", accent_gold)], 
                       foreground=[("selected", "#000000")])
        self.style.configure("Treeview.Heading", 
                             background="#2a2a2a", 
                             foreground=text_white, 
                             borderwidth=0,
                             font=("Segoe UI", 10, "bold"))
        
        # Scrollbar styling
        self.style.configure("Vertical.TScrollbar", 
                             background="#2a2a2a", 
                             troughcolor=bg_dark,
                             arrowcolor=text_white,
                             borderwidth=0)

    # -------------------------------------------------------------
    # DATA LOADING & SAVING
    # -------------------------------------------------------------
    def load_config(self):
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                    cfg = json.load(f)
                    if "processed_ids" not in cfg:
                        cfg["processed_ids"] = []
                    return cfg
            except Exception as e:
                safe_log(f"Error loading config: {e}")
        return {"email": "", "password": "", "remember": False, "processed_ids": []}

    def save_config(self, email, password, remember):
        processed_ids = self.config.get("processed_ids", [])
        self.config = {
            "email": email, 
            "password": password if remember else "", 
            "remember": remember,
            "processed_ids": processed_ids
        }
        try:
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=2)
        except Exception as e:
            safe_log(f"Error saving config: {e}")

    def save_processed_ids(self):
        try:
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=2)
        except Exception as e:
            safe_log(f"Error saving config with processed_ids: {e}")

    def load_personal_transactions(self):
        if os.path.exists(PERSONAL_FILE):
            try:
                with open(PERSONAL_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        return data
            except Exception as e:
                safe_log(f"Error loading personal file: {e}")
        return []

    def save_personal_transactions(self):
        try:
            with open(PERSONAL_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.personal_transactions, f, ensure_ascii=False, indent=2)
        except Exception as e:
            safe_log(f"Error saving personal file: {e}")

    # -------------------------------------------------------------
    # FIREBASE API WORKERS
    # -------------------------------------------------------------
    def authenticate_firebase(self, email, password, callback):
        def run():
            url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
            payload = {
                "email": email,
                "password": password,
                "returnSecureToken": True
            }
            try:
                response = requests.post(url, json=payload, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    self.firebase_token = data.get("idToken")
                    callback(True, None)
                else:
                    err_msg = "Credenciales incorrectas"
                    try:
                        err_code = response.json().get("error", {}).get("message")
                        if err_code == "EMAIL_NOT_FOUND" or err_code == "INVALID_PASSWORD" or err_code == "INVALID_LOGIN_CREDENTIALS":
                            err_msg = "Email o contraseña incorrectos."
                        elif err_code == "USER_DISABLED":
                            err_msg = "Esta cuenta de administrador ha sido deshabilitada."
                        else:
                            err_msg = f"Error: {err_code}"
                    except:
                        pass
                    callback(False, err_msg)
            except Exception as e:
                callback(False, f"Error de conexión: {str(e)}")
        
        threading.Thread(target=run, daemon=True).start()

    def fetch_firestore_history(self, callback):
        if not self.firebase_token:
            callback(False, "No autenticado")
            return

        def run():
            url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/history"
            headers = {"Authorization": f"Bearer {self.firebase_token}"}
            documents = []
            next_page_token = None
            
            try:
                while True:
                    params = {"pageSize": 300}
                    if next_page_token:
                        params["pageToken"] = next_page_token
                    
                    response = requests.get(url, headers=headers, params=params, timeout=15)
                    if response.status_code == 200:
                        data = response.json()
                        docs = data.get("documents", [])
                        documents.extend(docs)
                        next_page_token = data.get("nextPageToken")
                        if not next_page_token:
                            break
                    elif response.status_code == 401 or response.status_code == 403:
                        callback(False, "Sesión expirada. Por favor, vuelva a iniciar sesión.")
                        return
                    else:
                        callback(False, f"Error del servidor (HTTP {response.status_code})")
                        return
                
                # Parse documents
                parsed_docs = []
                for doc in documents:
                    parsed_docs.append(self.parse_firestore_doc(doc))
                
                self.cuycito_transactions = parsed_docs
                callback(True, None)
            except Exception as e:
                callback(False, f"Error al descargar datos: {str(e)}")
        
        threading.Thread(target=run, daemon=True).start()

    def parse_firestore_value(self, field_val):
        if not isinstance(field_val, dict):
            return field_val
        for k, v in field_val.items():
            if k == 'stringValue':
                return v
            elif k == 'integerValue':
                return int(v)
            elif k == 'doubleValue':
                return float(v)
            elif k == 'booleanValue':
                return bool(v)
            elif k == 'mapValue':
                return {mk: self.parse_firestore_value(mv) for mk, mv in v.get('fields', {}).items()}
            elif k == 'arrayValue':
                return [self.parse_firestore_value(av) for av in v.get('values', [])]
        return None

    def parse_firestore_doc(self, doc_dict):
        fields = doc_dict.get('fields', {})
        parsed = {}
        for k, v in fields.items():
            parsed[k] = self.parse_firestore_value(v)
        parsed['id'] = doc_dict.get('name', '').split('/')[-1]
        return parsed

    # -------------------------------------------------------------
    # DATE PARSING & FILTERING (STRICT INCOME / EXPENSE ONLY)
    # -------------------------------------------------------------
    def filter_data(self):
        month_name = self.current_month.get()
        month_code = self.months_map[month_name]
        year_code = self.current_year.get()

        # Filter Personal
        self.filtered_personal = []
        for tx in self.personal_transactions:
            if self.match_date(tx.get("date"), month_code, year_code):
                self.filtered_personal.append(tx)

        # Filter CuycitoGo (Strictly only VENTA, INGRESO, RECARGA, etc. and COMPRA, EGRESO, etc.)
        self.filtered_cuycito = []
        valid_types = [
            "VENTA", "INGRESO", "RECARGA_MANUAL", "RECARGA", "ABONO", "DEPOSITO",
            "COMPRA", "EGRESO", "REMBOLSADO", "DEVOLUCION", "PAGO", "COSTO"
        ]
        
        show_processed = self.show_processed_var.get()
        processed_set = set(self.config.get("processed_ids", []))
        
        for tx in self.cuycito_transactions:
            tx_id = tx.get("id")
            if not show_processed and tx_id in processed_set:
                continue
            tx_type = str(tx.get("type", "")).upper()
            if tx_type in valid_types:
                if self.match_date(tx.get("date"), month_code, year_code):
                    self.filtered_cuycito.append(tx)

        # Update Views
        self.update_summary_cards()
        self.populate_personal_table()
        self.populate_cuycito_table()

    def match_date(self, date_str, target_month, target_year):
        if not date_str:
            return False
        date_str = str(date_str).strip()
        
        # Format DD/MM/AAAA
        if '/' in date_str:
            parts = date_str.split('/')
            if len(parts) >= 3:
                day, month, year = parts[0], parts[1], parts[2]
                year = year.split(' ')[0].split('T')[0]
                if month.zfill(2) == target_month and year == target_year:
                    return True
        # Format YYYY-MM-DD
        elif '-' in date_str:
            parts = date_str.split('-')
            if len(parts) >= 3:
                year, month = parts[0], parts[1]
                if month.zfill(2) == target_month and year == target_year:
                    return True
        return False

    # -------------------------------------------------------------
    # SCREEN SWITCHERS & LOGIN UI
    # -------------------------------------------------------------
    def show_login_screen(self):
        if self.main_container:
            self.main_container.destroy()
            self.main_container = None
            
        self.login_frame = tk.Frame(self.root, bg="#121212")
        self.login_frame.place(relx=0.5, rely=0.5, anchor="center")

        # Brand / Logo
        logo_label = tk.Label(self.login_frame, text="💼", font=("Segoe UI", 60), bg="#121212", fg="#ffb703")
        logo_label.pack(pady=(0, 5))
        
        title_label = tk.Label(self.login_frame, text="Finanzas", font=("Impact", 28), bg="#121212", fg="#ffb703")
        title_label.pack()
        
        sub_label = tk.Label(self.login_frame, text="CONTROL DE GASTOS PERSONAL & NEGOCIO", font=("Segoe UI", 8, "bold"), bg="#121212", fg="#888888")
        sub_label.pack(pady=(0, 25))

        # Login Form Card
        form_card = tk.Frame(self.login_frame, bg="#1e1e1e", padx=30, pady=30, highlightbackground="#ffb703", highlightthickness=1)
        form_card.pack(fill="both", expand=True)

        email_lbl = tk.Label(form_card, text="Correo de Administrador", font=("Segoe UI", 10, "bold"), bg="#1e1e1e", fg="#aaaaaa")
        email_lbl.grid(row=0, column=0, sticky="w", pady=(0, 5))
        
        self.email_entry = tk.Entry(form_card, font=("Segoe UI", 11), bg="#0f0f0f", fg="#ffffff", insertbackground="white", width=30, bd=0, highlightthickness=1, highlightcolor="#ffb703", highlightbackground="#333333")
        self.email_entry.grid(row=1, column=0, ipady=8, pady=(0, 15))
        self.email_entry.insert(0, self.config.get("email", ""))

        pass_lbl = tk.Label(form_card, text="Contraseña", font=("Segoe UI", 10, "bold"), bg="#1e1e1e", fg="#aaaaaa")
        pass_lbl.grid(row=2, column=0, sticky="w", pady=(0, 5))
        
        self.pass_entry = tk.Entry(form_card, show="•", font=("Segoe UI", 11), bg="#0f0f0f", fg="#ffffff", insertbackground="white", width=30, bd=0, highlightthickness=1, highlightcolor="#ffb703", highlightbackground="#333333")
        self.pass_entry.grid(row=3, column=0, ipady=8, pady=(0, 10))
        self.pass_entry.insert(0, self.config.get("password", ""))

        self.remember_var = tk.BooleanVar(value=self.config.get("remember", False))
        remember_cb = tk.Checkbutton(form_card, text="Recordar contraseña", variable=self.remember_var, font=("Segoe UI", 9), bg="#1e1e1e", fg="#ffffff", selectcolor="#0f0f0f", activebackground="#1e1e1e", activeforeground="#ffffff", bd=0, highlightthickness=0)
        remember_cb.grid(row=4, column=0, sticky="w", pady=(0, 15))

        self.login_status_lbl = tk.Label(form_card, text="", font=("Segoe UI", 9, "bold"), bg="#1e1e1e", fg="#d90429")
        self.login_status_lbl.grid(row=5, column=0, pady=(0, 10))

        self.login_btn = tk.Button(form_card, text="INGRESAR AL DEPOSITARIO", font=("Segoe UI", 11, "bold"), bg="#850000", fg="#ffffff", activebackground="#a10000", activeforeground="#ffffff", bd=0, cursor="hand2", width=26, command=self.handle_login_click)
        self.login_btn.grid(row=6, column=0, ipady=10)

        if self.config.get("remember") and self.config.get("email") and self.config.get("password"):
            # Delay slightly to avoid window manager bugs
            self.root.after(100, self.handle_login_click)

    def handle_login_click(self):
        email = self.email_entry.get().strip()
        password = self.pass_entry.get().strip()
        remember = self.remember_var.get()
        
        if not email or not password:
            self.login_status_lbl.config(text="Por favor complete todos los campos.")
            return

        self.login_btn.config(state="disabled", text="Autenticando...")
        self.login_status_lbl.config(text="", fg="#ffb703")
        
        def on_auth_result(success, error_msg):
            if success:
                self.save_config(email, password, remember)
                self.root.after(0, self.show_dashboard_screen)
            else:
                self.root.after(0, lambda: self.login_btn.config(state="normal", text="INGRESAR AL DEPOSITARIO"))
                self.root.after(0, lambda: self.login_status_lbl.config(text=f"❌ {error_msg}", fg="#d90429"))
                
        self.authenticate_firebase(email, password, on_auth_result)

    # -------------------------------------------------------------
    # MAIN DASHBOARD SCREEN UI
    # -------------------------------------------------------------
    def show_dashboard_screen(self):
        if self.login_frame:
            self.login_frame.destroy()
            self.login_frame = None

        self.main_container = tk.Frame(self.root, bg="#121212")
        self.main_container.pack(fill="both", expand=True, padx=20, pady=15)

        # HEADER BAR
        header_frame = tk.Frame(self.main_container, bg="#121212")
        header_frame.pack(fill="x", pady=(0, 15))
        
        brand_lbl = tk.Label(header_frame, text="💼 Finanzas • Control Personal & Negocio", font=("Segoe UI", 16, "bold"), bg="#121212", fg="#ffb703")
        brand_lbl.pack(side="left")

        user_info_frame = tk.Frame(header_frame, bg="#121212")
        user_info_frame.pack(side="right")
        
        user_lbl = tk.Label(user_info_frame, text=self.config.get("email"), font=("Segoe UI", 9, "italic"), bg="#121212", fg="#888888")
        user_lbl.pack(side="left", padx=(0, 10))

        logout_btn = tk.Button(user_info_frame, text="Cerrar Sesión", font=("Segoe UI", 9, "bold"), bg="#d90429", fg="#ffffff", activebackground="#ff4d6d", activeforeground="#ffffff", bd=0, cursor="hand2", command=self.handle_logout)
        logout_btn.pack(side="left")

        # FILTER & GLOBAL SUMMARY ROW
        filter_summary_frame = tk.Frame(self.main_container, bg="#121212")
        filter_summary_frame.pack(fill="x", pady=(0, 20))

        # Month / Year Filter Widget
        filter_card = tk.Frame(filter_summary_frame, bg="#1e1e1e", padx=15, pady=10, highlightbackground="#333333", highlightthickness=1)
        filter_card.pack(side="left", fill="y")
        
        filter_lbl = tk.Label(filter_card, text="Período de Análisis:", font=("Segoe UI", 10, "bold"), bg="#1e1e1e", fg="#ffffff")
        filter_lbl.grid(row=0, column=0, columnspan=2, sticky="w", pady=(0, 5))

        month_cb = ttk.Combobox(filter_card, textvariable=self.current_month, values=list(self.months_map.keys()), width=10, state="readonly")
        month_cb.grid(row=1, column=0, padx=(0, 5), ipady=3)
        month_cb.bind("<<ComboboxSelected>>", lambda e: self.filter_data())

        year_cb = ttk.Combobox(filter_card, textvariable=self.current_year, values=["2024", "2025", "2026", "2027"], width=6, state="readonly")
        year_cb.grid(row=1, column=1, ipady=3)
        year_cb.bind("<<ComboboxSelected>>", lambda e: self.filter_data())

        # Cards Frame (Global Financial Summary)
        cards_frame = tk.Frame(filter_summary_frame, bg="#121212")
        cards_frame.pack(side="right", fill="x", expand=True, padx=(20, 0))

        # Ingresos Card
        self.inc_card = tk.Frame(cards_frame, bg="#1e1e1e", padx=20, pady=10, highlightbackground="#10b981", highlightthickness=1)
        self.inc_card.pack(side="left", fill="both", expand=True, padx=(0, 10))
        tk.Label(self.inc_card, text="INGRESOS GLOBALES", font=("Segoe UI", 9, "bold"), bg="#1e1e1e", fg="#10b981").pack(anchor="w")
        self.global_income_lbl = tk.Label(self.inc_card, text="S/ 0.00", font=("Segoe UI", 16, "bold"), bg="#1e1e1e", fg="#ffffff")
        self.global_income_lbl.pack(anchor="w", pady=(2, 0))

        # Egresos Card
        self.exp_card = tk.Frame(cards_frame, bg="#1e1e1e", padx=20, pady=10, highlightbackground="#d90429", highlightthickness=1)
        self.exp_card.pack(side="left", fill="both", expand=True, padx=5)
        tk.Label(self.exp_card, text="EGRESOS GLOBALES", font=("Segoe UI", 9, "bold"), bg="#1e1e1e", fg="#d90429").pack(anchor="w")
        self.global_expense_lbl = tk.Label(self.exp_card, text="S/ 0.00", font=("Segoe UI", 16, "bold"), bg="#1e1e1e", fg="#ffffff")
        self.global_expense_lbl.pack(anchor="w", pady=(2, 0))

        # Balance Card
        self.bal_card = tk.Frame(cards_frame, bg="#1e1e1e", padx=20, pady=10, highlightbackground="#ffb703", highlightthickness=1)
        self.bal_card.pack(side="left", fill="both", expand=True, padx=(10, 0))
        tk.Label(self.bal_card, text="BALANCE NETO GLOBAL", font=("Segoe UI", 9, "bold"), bg="#1e1e1e", fg="#ffb703").pack(anchor="w")
        self.global_balance_lbl = tk.Label(self.bal_card, text="S/ 0.00", font=("Segoe UI", 16, "bold"), bg="#1e1e1e", fg="#ffffff")
        self.global_balance_lbl.pack(anchor="w", pady=(2, 0))

        # TAB CONTROL HEADER
        tab_header_frame = tk.Frame(self.main_container, bg="#121212")
        tab_header_frame.pack(fill="x", pady=(0, 10))

        self.btn_tab_personal = tk.Button(tab_header_frame, text="👤 GASTOS PERSONALES", font=("Segoe UI", 10, "bold"), bg="#ffb703", fg="#000000", activebackground="#ffb703", activeforeground="#000000", bd=0, cursor="hand2", command=lambda: self.switch_tab("personal"))
        self.btn_tab_personal.pack(side="left", padx=(0, 5), ipady=5, ipadx=10)

        self.btn_tab_cuycito = tk.Button(tab_header_frame, text="🐹 CUYCITOGO NEGOCIO", font=("Segoe UI", 10, "bold"), bg="#2a2a2a", fg="#ffffff", activebackground="#ffb703", activeforeground="#000000", bd=0, cursor="hand2", command=lambda: self.switch_tab("cuycito"))
        self.btn_tab_cuycito.pack(side="left", ipady=5, ipadx=10)

        # TAB CONTAINER
        self.tab_container = tk.Frame(self.main_container, bg="#1e1e1e", highlightbackground="#333333", highlightthickness=1)
        self.tab_container.pack(fill="both", expand=True)

        # Tab Frames
        self.personal_frame = tk.Frame(self.tab_container, bg="#1e1e1e")
        self.cuycito_frame = tk.Frame(self.tab_container, bg="#1e1e1e")
        
        self.create_personal_tab_ui()
        self.create_cuycito_tab_ui()

        self.switch_tab("personal")
        self.sync_cuycito_data()

    def switch_tab(self, tab_name):
        if tab_name == "personal":
            self.cuycito_frame.pack_forget()
            self.personal_frame.pack(fill="both", expand=True, padx=15, pady=15)
            self.btn_tab_personal.config(bg="#ffb703", fg="#000000")
            self.btn_tab_cuycito.config(bg="#2a2a2a", fg="#ffffff")
        else:
            self.personal_frame.pack_forget()
            self.cuycito_frame.pack(fill="both", expand=True, padx=15, pady=15)
            self.btn_tab_personal.config(bg="#2a2a2a", fg="#ffffff")
            self.btn_tab_cuycito.config(bg="#ffb703", fg="#000000")

    def handle_logout(self):
        self.firebase_token = None
        self.cuycito_transactions = []
        self.filtered_cuycito = []
        self.show_login_screen()

    # -------------------------------------------------------------
    # TAB 1: PERSONAL FINANCE TAB UI & LOGIC
    # -------------------------------------------------------------
    def create_personal_tab_ui(self):
        left_form = tk.Frame(self.personal_frame, bg="#1e1e1e", width=300)
        left_form.pack(side="left", fill="y", padx=(0, 20))
        left_form.pack_propagate(False)

        right_table = tk.Frame(self.personal_frame, bg="#1e1e1e")
        right_table.pack(side="right", fill="both", expand=True)

        tk.Label(left_form, text="Registrar Gasto / Ingreso", font=("Segoe UI", 11, "bold"), bg="#1e1e1e", fg="#ffb703").pack(anchor="w", pady=(0, 15))

        tk.Label(left_form, text="Fecha (DD/MM/AAAA):", font=("Segoe UI", 9, "bold"), bg="#1e1e1e", fg="#aaaaaa").pack(anchor="w")
        self.p_date_entry = tk.Entry(left_form, font=("Segoe UI", 10), bg="#0f0f0f", fg="#ffffff", insertbackground="white", bd=0, highlightthickness=1, highlightcolor="#ffb703", highlightbackground="#333333")
        self.p_date_entry.pack(fill="x", ipady=5, pady=(2, 12))
        self.p_date_entry.insert(0, datetime.date.today().strftime("%d/%m/%Y"))

        tk.Label(left_form, text="Tipo:", font=("Segoe UI", 9, "bold"), bg="#1e1e1e", fg="#aaaaaa").pack(anchor="w")
        self.p_type_var = tk.StringVar(value="Egreso")
        p_type_cb = ttk.Combobox(left_form, textvariable=self.p_type_var, values=["Ingreso", "Egreso"], state="readonly")
        p_type_cb.pack(fill="x", ipady=3, pady=(2, 12))

        tk.Label(left_form, text="Monto (S/):", font=("Segoe UI", 9, "bold"), bg="#1e1e1e", fg="#aaaaaa").pack(anchor="w")
        self.p_amount_entry = tk.Entry(left_form, font=("Segoe UI", 10), bg="#0f0f0f", fg="#ffffff", insertbackground="white", bd=0, highlightthickness=1, highlightcolor="#ffb703", highlightbackground="#333333")
        self.p_amount_entry.pack(fill="x", ipady=5, pady=(2, 12))

        tk.Label(left_form, text="Categoría:", font=("Segoe UI", 9, "bold"), bg="#1e1e1e", fg="#aaaaaa").pack(anchor="w")
        self.p_category_var = tk.StringVar(value="Comida")
        p_category_cb = ttk.Combobox(left_form, textvariable=self.p_category_var, values=["Comida", "Transporte", "Alquiler", "Sueldo", "Servicios", "Entretenimiento", "Estudios", "Negocio", "Otros"], state="readonly")
        p_category_cb.pack(fill="x", ipady=3, pady=(2, 12))

        tk.Label(left_form, text="Concepto / Descripción:", font=("Segoe UI", 9, "bold"), bg="#1e1e1e", fg="#aaaaaa").pack(anchor="w")
        self.p_desc_entry = tk.Entry(left_form, font=("Segoe UI", 10), bg="#0f0f0f", fg="#ffffff", insertbackground="white", bd=0, highlightthickness=1, highlightcolor="#ffb703", highlightbackground="#333333")
        self.p_desc_entry.pack(fill="x", ipady=5, pady=(2, 20))

        add_btn = tk.Button(left_form, text="AGREGAR TRANSACCIÓN", font=("Segoe UI", 10, "bold"), bg="#ffb703", fg="#000000", activebackground="#e0a100", activeforeground="#000000", bd=0, cursor="hand2", command=self.handle_add_personal)
        add_btn.pack(fill="x", ipady=8)

        table_top = tk.Frame(right_table, bg="#1e1e1e")
        table_top.pack(fill="x", pady=(0, 10))
        
        tk.Label(table_top, text="Historial de Transacciones Personales", font=("Segoe UI", 11, "bold"), bg="#1e1e1e", fg="#ffffff").pack(side="left")
        
        delete_btn = tk.Button(table_top, text="🗑️ Eliminar Seleccionado", font=("Segoe UI", 9, "bold"), bg="#d90429", fg="#ffffff", activebackground="#a10000", activeforeground="#ffffff", bd=0, cursor="hand2", command=self.handle_delete_personal)
        delete_btn.pack(side="right", ipady=3, ipadx=8)

        tree_scroll = ttk.Scrollbar(right_table, orient="vertical", style="Vertical.TScrollbar")
        tree_scroll.pack(side="right", fill="y")

        cols = ("date", "type", "category", "amount", "description")
        self.personal_tree = ttk.Treeview(right_table, columns=cols, show="headings", yscrollcommand=tree_scroll.set)
        self.personal_tree.pack(fill="both", expand=True)
        tree_scroll.config(command=self.personal_tree.yview)

        self.personal_tree.heading("date", text="Fecha")
        self.personal_tree.heading("type", text="Tipo")
        self.personal_tree.heading("category", text="Categoría")
        self.personal_tree.heading("amount", text="Monto (S/)")
        self.personal_tree.heading("description", text="Descripción / Concepto")

        self.personal_tree.column("date", width=100, anchor="center")
        self.personal_tree.column("type", width=90, anchor="center")
        self.personal_tree.column("category", width=120, anchor="center")
        self.personal_tree.column("amount", width=100, anchor="e")
        self.personal_tree.column("description", width=250, anchor="w")

        self.personal_tree.tag_configure("income", foreground="#4ade80")
        self.personal_tree.tag_configure("expense", foreground="#f87171")

        self.populate_personal_table()

    def populate_personal_table(self):
        for item in self.personal_tree.get_children():
            self.personal_tree.delete(item)

        sorted_personal = sorted(self.filtered_personal, key=lambda x: self.parse_date_sort(x.get("date")), reverse=True)

        for tx in sorted_personal:
            tx_type = tx.get("type", "Egreso")
            is_income = tx_type == "Ingreso"
            
            amount_val = float(tx.get("amount", 0))
            if is_income:
                amount_str = f"+ S/ {amount_val:.2f}"
                tag = "income"
            else:
                amount_str = f"- S/ {amount_val:.2f}"
                tag = "expense"

            self.personal_tree.insert("", "end", iid=tx["id"], values=(
                tx.get("date"),
                tx_type,
                tx.get("category"),
                amount_str,
                tx.get("description")
            ), tags=(tag,))

    def parse_date_sort(self, date_str):
        if not date_str:
            return datetime.date.min
        try:
            if '/' in date_str:
                parts = date_str.split('/')
                day = int(parts[0])
                month = int(parts[1])
                year = int(parts[2].split(' ')[0].split('T')[0])
                return datetime.date(year, month, day)
            elif '-' in date_str:
                parts = date_str.split('-')
                year = int(parts[0])
                month = int(parts[1])
                day = int(parts[2].split(' ')[0].split('T')[0])
                return datetime.date(year, month, day)
        except:
            pass
        return datetime.date.min

    def handle_add_personal(self):
        date = self.p_date_entry.get().strip()
        type_tx = self.p_type_var.get()
        amount_str = self.p_amount_entry.get().strip()
        category = self.p_category_var.get()
        desc = self.p_desc_entry.get().strip()

        if not date or not amount_str or not desc:
            messagebox.showwarning("Campos vacíos", "Por favor completa todos los campos para registrar la transacción.")
            return

        try:
            amount = float(amount_str)
            if amount <= 0:
                raise ValueError
        except ValueError:
            messagebox.showerror("Monto inválido", "El monto debe ser un número positivo.")
            return

        try:
            if '/' in date:
                parts = date.split('/')
                datetime.date(int(parts[2]), int(parts[1]), int(parts[0]))
            elif '-' in date:
                parts = date.split('-')
                datetime.date(int(parts[0]), int(parts[1]), int(parts[2]))
            else:
                raise ValueError
        except Exception:
            messagebox.showerror("Fecha inválida", "La fecha debe estar en formato válido DD/MM/AAAA (ej. 25/08/2026).")
            return

        tx_id = f"pers_{int(datetime.datetime.now().timestamp() * 1000)}"
        new_tx = {
            "id": tx_id,
            "date": date,
            "type": type_tx,
            "category": category,
            "amount": amount,
            "description": desc
        }

        self.personal_transactions.append(new_tx)
        self.save_personal_transactions()
        
        self.p_amount_entry.delete(0, tk.END)
        self.p_desc_entry.delete(0, tk.END)
        self.p_date_entry.delete(0, tk.END)
        self.p_date_entry.insert(0, datetime.date.today().strftime("%d/%m/%Y"))

        self.filter_data()
        messagebox.showinfo("Éxito", "Transacción personal registrada correctamente.")

    def handle_delete_personal(self):
        selected_item = self.personal_tree.selection()
        if not selected_item:
            messagebox.showwarning("Selección requerida", "Por favor selecciona una transacción de la tabla para eliminar.")
            return

        tx_id = selected_item[0]
        if messagebox.askyesno("Confirmar eliminación", "¿Estás seguro de que deseas eliminar esta transacción personal?"):
            self.personal_transactions = [t for t in self.personal_transactions if t["id"] != tx_id]
            self.save_personal_transactions()
            self.filter_data()
            messagebox.showinfo("Eliminado", "Transacción eliminada con éxito.")

    # -------------------------------------------------------------
    # TAB 2: CUYCITOGO BUSINESS TAB UI & LOGIC (READ-ONLY 🔒)
    # -------------------------------------------------------------
    def create_cuycito_tab_ui(self):
        metrics_panel = tk.Frame(self.cuycito_frame, bg="#1e1e1e")
        metrics_panel.pack(fill="x", pady=(0, 15))

        c_inc_card = tk.Frame(metrics_panel, bg="#2a2a2a", padx=15, pady=8, highlightbackground="#333333", highlightthickness=1)
        c_inc_card.pack(side="left", fill="both", expand=True, padx=(0, 5))
        tk.Label(c_inc_card, text="INGRESOS CUYCITOGO (Ventas)", font=("Segoe UI", 9, "bold"), bg="#2a2a2a", fg="#10b981").pack(anchor="w")
        self.cuy_income_lbl = tk.Label(c_inc_card, text="S/ 0.00", font=("Segoe UI", 13, "bold"), bg="#2a2a2a", fg="#ffffff")
        self.cuy_income_lbl.pack(anchor="w")

        c_exp_card = tk.Frame(metrics_panel, bg="#2a2a2a", padx=15, pady=8, highlightbackground="#333333", highlightthickness=1)
        c_exp_card.pack(side="left", fill="both", expand=True, padx=5)
        tk.Label(c_exp_card, text="EGRESOS CUYCITOGO (Compras/Costos)", font=("Segoe UI", 9, "bold"), bg="#2a2a2a", fg="#d90429").pack(anchor="w")
        self.cuy_expense_lbl = tk.Label(c_exp_card, text="S/ 0.00", font=("Segoe UI", 13, "bold"), bg="#2a2a2a", fg="#ffffff")
        self.cuy_expense_lbl.pack(anchor="w")

        c_util_card = tk.Frame(metrics_panel, bg="#2a2a2a", padx=15, pady=8, highlightbackground="#333333", highlightthickness=1)
        c_util_card.pack(side="left", fill="both", expand=True, padx=(5, 0))
        tk.Label(c_util_card, text="UTILIDAD DE OPERACIÓN", font=("Segoe UI", 9, "bold"), bg="#2a2a2a", fg="#ffb703").pack(anchor="w")
        self.cuy_utility_lbl = tk.Label(c_util_card, text="S/ 0.00", font=("Segoe UI", 13, "bold"), bg="#2a2a2a", fg="#ffffff")
        self.cuy_utility_lbl.pack(anchor="w")

        sync_row = tk.Frame(self.cuycito_frame, bg="#1e1e1e")
        sync_row.pack(fill="x", pady=(0, 10))

        tk.Label(sync_row, text="Transacciones de Cuycito Negocio (Sólo Lectura 🔒)", font=("Segoe UI", 11, "bold"), bg="#1e1e1e", fg="#ffffff").pack(side="left")

        self.show_processed_cb = tk.Checkbutton(sync_row, text="Mostrar procesados", variable=self.show_processed_var, font=("Segoe UI", 9), bg="#1e1e1e", fg="#ffffff", selectcolor="#0f0f0f", activebackground="#1e1e1e", activeforeground="#ffffff", bd=0, highlightthickness=0, command=self.filter_data)
        self.show_processed_cb.pack(side="left", padx=(15, 0))

        self.sync_btn = tk.Button(sync_row, text="🔄 Sincronizar Firebase", font=("Segoe UI", 9, "bold"), bg="#ffb703", fg="#000000", activebackground="#e0a100", activeforeground="#000000", bd=0, cursor="hand2", command=self.sync_cuycito_data)
        self.sync_btn.pack(side="right", ipady=3, ipadx=8)

        self.transfer_btn = tk.Button(sync_row, text="➡️ Registrar en Personal", font=("Segoe UI", 9, "bold"), bg="#10b981", fg="#ffffff", activebackground="#059669", activeforeground="#ffffff", bd=0, cursor="hand2", command=self.handle_transfer_to_personal)
        self.transfer_btn.pack(side="right", padx=(0, 10), ipady=3, ipadx=8)

        self.discard_btn = tk.Button(sync_row, text="🗑️ Ocultar del Negocio", font=("Segoe UI", 9, "bold"), bg="#d90429", fg="#ffffff", activebackground="#a10000", activeforeground="#ffffff", bd=0, cursor="hand2", command=self.handle_discard_cuycito)
        self.discard_btn.pack(side="right", padx=(0, 10), ipady=3, ipadx=8)

        self.cuycito_status_lbl = tk.Label(sync_row, text="", font=("Segoe UI", 9, "italic"), bg="#1e1e1e", fg="#aaaaaa")
        self.cuycito_status_lbl.pack(side="right", padx=(0, 15))

        table_frame = tk.Frame(self.cuycito_frame, bg="#1e1e1e")
        table_frame.pack(fill="both", expand=True)

        tree_scroll = ttk.Scrollbar(table_frame, orient="vertical", style="Vertical.TScrollbar")
        tree_scroll.pack(side="right", fill="y")

        cols = ("date", "type", "person", "service", "amount_orig", "amount_pen")
        self.cuycito_tree = ttk.Treeview(table_frame, columns=cols, show="headings", yscrollcommand=tree_scroll.set, selectmode="extended")
        self.cuycito_tree.pack(fill="both", expand=True)
        tree_scroll.config(command=self.cuycito_tree.yview)

        self.cuycito_tree.heading("date", text="Fecha")
        self.cuycito_tree.heading("type", text="Tipo")
        self.cuycito_tree.heading("person", text="Cliente / Proveedor")
        self.cuycito_tree.heading("service", text="Servicio / Glosa")
        self.cuycito_tree.heading("amount_orig", text="Monto (Original)")
        self.cuycito_tree.heading("amount_pen", text="Equiv. Soles (S/)")

        self.cuycito_tree.column("date", width=100, anchor="center")
        self.cuycito_tree.column("type", width=100, anchor="center")
        self.cuycito_tree.column("person", width=180, anchor="w")
        self.cuycito_tree.column("service", width=150, anchor="center")
        self.cuycito_tree.column("amount_orig", width=120, anchor="e")
        self.cuycito_tree.column("amount_pen", width=120, anchor="e")

        self.cuycito_tree.tag_configure("income", foreground="#4ade80")
        self.cuycito_tree.tag_configure("expense", foreground="#f87171")

    def populate_cuycito_table(self):
        for item in self.cuycito_tree.get_children():
            self.cuycito_tree.delete(item)

        sorted_cuycito = sorted(self.filtered_cuycito, key=lambda x: self.parse_date_sort(x.get("date")), reverse=True)

        for tx in sorted_cuycito:
            currency = tx.get("currency", "PEN")
            amount_val = float(tx.get("amount", 0))
            
            tx_type = str(tx.get("type", "")).upper()
            is_income = tx_type in ["VENTA", "INGRESO", "RECARGA_MANUAL", "RECARGA", "ABONO", "DEPOSITO"]
            
            orig_sym = "$" if currency == "USD" else "S/"
            amount_pen = amount_val * EXCHANGE_RATE if currency == "USD" else amount_val
            
            if is_income:
                amount_orig_str = f"+ {orig_sym} {amount_val:.2f}"
                amount_pen_str = f"+ S/ {amount_pen:.2f}"
                tag = "income"
            else:
                amount_orig_str = f"- {orig_sym} {amount_val:.2f}"
                amount_pen_str = f"- S/ {amount_pen:.2f}"
                tag = "expense"

            self.cuycito_tree.insert("", "end", iid=tx.get("id"), values=(
                tx.get("date"),
                tx.get("type"),
                tx.get("person", "N/A"),
                tx.get("service", "-"),
                amount_orig_str,
                amount_pen_str
            ), tags=(tag,))

    def sync_cuycito_data(self):
        self.sync_btn.config(state="disabled")
        self.cuycito_status_lbl.config(text="Sincronizando...", fg="#ffb703")

        def on_sync_done(success, error_msg):
            self.sync_btn.config(state="normal")
            if success:
                self.cuycito_status_lbl.config(text="✓ Sincronizado", fg="#10b981")
                self.filter_data()
            else:
                self.cuycito_status_lbl.config(text="❌ Falló sincronización", fg="#d90429")
                messagebox.showerror("Error de Sincronización", error_msg)

        self.fetch_firestore_history(on_sync_done)

    def handle_transfer_to_personal(self):
        selected_items = self.cuycito_tree.selection()
        if not selected_items:
            messagebox.showwarning("Selección requerida", "Por favor selecciona una o más transacciones de la tabla de CuycitoGo para registrarlas en Personal.")
            return

        if "processed_ids" not in self.config:
            self.config["processed_ids"] = []

        imported_count = 0
        for tx_id in selected_items:
            tx = next((t for t in self.cuycito_transactions if t.get("id") == tx_id), None)
            if not tx:
                continue

            if tx_id in self.config["processed_ids"]:
                continue

            tx_type = str(tx.get("type", "")).upper()
            if tx_type in ["VENTA", "INGRESO", "RECARGA_MANUAL", "RECARGA", "ABONO", "DEPOSITO"]:
                personal_type = "Ingreso"
            else:
                personal_type = "Egreso"

            currency = tx.get("currency", "PEN")
            amount_val = float(tx.get("amount", 0))
            amount_pen = amount_val * EXCHANGE_RATE if currency == "USD" else amount_val

            person = tx.get("person", "N/A")
            service = tx.get("service", "-")
            desc = f"Negocio: {service} ({person})"

            pers_tx_id = f"pers_{int(datetime.datetime.now().timestamp() * 1000) + imported_count}"
            new_personal_tx = {
                "id": pers_tx_id,
                "date": tx.get("date"),
                "type": personal_type,
                "category": "Negocio",
                "amount": amount_pen,
                "description": desc
            }

            self.personal_transactions.append(new_personal_tx)
            self.config["processed_ids"].append(tx_id)
            imported_count += 1

        if imported_count > 0:
            self.save_personal_transactions()
            self.save_processed_ids()
            self.filter_data()
            messagebox.showinfo("Éxito", f"Se registraron {imported_count} transacciones en tu historial Personal con éxito.")
        else:
            messagebox.showinfo("Información", "No se importó ninguna transacción nueva.")

    def handle_discard_cuycito(self):
        selected_items = self.cuycito_tree.selection()
        if not selected_items:
            messagebox.showwarning("Selección requerida", "Por favor selecciona una o más transacciones de la tabla de CuycitoGo para ocultarlas.")
            return

        if "processed_ids" not in self.config:
            self.config["processed_ids"] = []

        discard_count = 0
        for tx_id in selected_items:
            if tx_id not in self.config["processed_ids"]:
                self.config["processed_ids"].append(tx_id)
                discard_count += 1

        if discard_count > 0:
            self.save_processed_ids()
            self.filter_data()
            messagebox.showinfo("Éxito", f"Se ocultaron {discard_count} transacciones de la vista de CuycitoGo.")

    # -------------------------------------------------------------
    # CALCULATIONS & SUMMARY PANEL UPDATES
    # -------------------------------------------------------------
    def update_summary_cards(self):
        # 1. Personal calculations
        p_income = 0
        p_expense = 0
        for tx in self.filtered_personal:
            amt = float(tx.get("amount", 0))
            if tx.get("type") == "Ingreso":
                p_income += amt
            else:
                p_expense += amt

        # 2. CuycitoGo calculations (Strict mapping to Income vs Expense)
        c_income = 0
        c_expense = 0
        for tx in self.filtered_cuycito:
            amt = float(tx.get("amount", 0))
            currency = tx.get("currency", "PEN")
            amt_pen = amt * EXCHANGE_RATE if currency == "USD" else amt
            
            tx_type = str(tx.get("type", "")).upper()
            if tx_type in ["VENTA", "INGRESO", "RECARGA_MANUAL", "RECARGA", "ABONO", "DEPOSITO"]:
                c_income += amt_pen
            elif tx_type in ["COMPRA", "EGRESO", "REMBOLSADO", "DEVOLUCION", "PAGO", "COSTO"]:
                c_expense += amt_pen

        # Update CuycitoGo tab metrics
        self.cuy_income_lbl.config(text=f"S/ {c_income:.2f}")
        self.cuy_expense_lbl.config(text=f"S/ {c_expense:.2f}")
        c_util = c_income - c_expense
        self.cuy_utility_lbl.config(text=f"S/ {c_util:.2f}")

        # 3. Global Combined Calculations
        g_income = p_income + c_income
        g_expense = p_expense + c_expense
        g_balance = g_income - g_expense

        self.global_income_lbl.config(text=f"S/ {g_income:.2f}")
        self.global_expense_lbl.config(text=f"S/ {g_expense:.2f}")
        self.global_balance_lbl.config(text=f"S/ {g_balance:.2f}")

        if g_balance >= 0:
            self.bal_card.config(highlightbackground="#10b981")
            self.global_balance_lbl.config(fg="#10b981")
        else:
            self.bal_card.config(highlightbackground="#d90429")
            self.global_balance_lbl.config(fg="#d90429")


if __name__ == "__main__":
    root = tk.Tk()
    app = FinanzasApp(root)
    root.mainloop()
