import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Login from './components/Login.jsx';
import EmployeePanel from './components/EmployeePanel.jsx';
import AdminPanel from './components/AdminPanel.jsx';

// URL del Google Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbzgSEmCuGP8NH4CBDuc6KDsqR53rIq6lhuScSdwn2eMicLK0gokPHn1FkIibgyYPLQSHg/exec";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);

  // ============================================================
  // FUNCIÓN: VALIDAR SESIÓN
  // ============================================================
  const isValidSession = useCallback((userData) => {
    if (!userData) return false;
    const sessionTime = userData._sessionTime || 0;
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    return (now - sessionTime) < twentyFourHours;
  }, []);

  // ============================================================
  // FUNCIÓN: VERIFICAR Y RESTAURAR SESIÓN
  // ============================================================
  const restoreSession = useCallback(() => {
    try {
      const savedUser = localStorage.getItem('ferre_user_session');
      if (!savedUser) {
        setIsInitializing(false);
        return null;
      }

      const parsedUser = JSON.parse(savedUser);
      
      if (isValidSession(parsedUser)) {
        setUser(parsedUser);
        setIsInitializing(false);
        return parsedUser;
      } else {
        localStorage.removeItem('ferre_user_session');
        setIsInitializing(false);
        return null;
      }
    } catch (e) {
      localStorage.removeItem('ferre_user_session');
      setIsInitializing(false);
      return null;
    }
  }, [isValidSession]);

  // ============================================================
  // EFECTO: RESTAURAR SESIÓN AL INICIAR
  // ============================================================
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // ============================================================
  // FUNCIÓN: LOGIN OPTIMIZADO
  // ============================================================
  const handleLoginSubmit = useCallback(async (username, pin) => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'LOGIN',
          username: username,
          pin: pin
        })
      });

      const responseText = await response.text();
      console.log("Respuesta cruda de Google:", responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error("Google Apps Script devolvió un formato incorrecto.");
      }

      console.log("Datos del login:", data);

      if (data.success && data.user) {
        const userData = {
          id: data.user.id,
          name: data.user.name,
          store: data.user.store,
          role: data.user.role,
          scheduleIn: data.user.scheduleIn,
          scheduleOut: data.user.scheduleOut,
          rawLV: data.user.rawLV,
          rawLun: data.user.rawLun,
          rawMar: data.user.rawMar,
          rawMie: data.user.rawMie,
          rawJue: data.user.rawJue,
          rawVie: data.user.rawVie,
          rawSab: data.user.rawSab,
          rawDom: data.user.rawDom,
          lastMovement: data.user.lastMovement,
          onVacation: data.user.onVacation || false,
          vacations: data.user.vacations || null,
          _sessionTime: Date.now()
        };
        
        setUser(userData);
        localStorage.setItem('ferre_user_session', JSON.stringify(userData));
        
        console.log("Usuario seteado en App:", data.user);
      } else {
        setError(data.error || 'Credenciales inválidas.');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================
  // FUNCIÓN: LOGOUT
  // ============================================================
  const handleLogout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('ferre_user_session');
    // Limpiar caché del usuario
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      if (key.includes('hours_') || key.includes('step_')) {
        sessionStorage.removeItem(key);
      }
    });
  }, []);

  // ============================================================
  // EFECTO: VERIFICAR SESIÓN EXPIRADA (cada minuto)
  // ============================================================
  useEffect(() => {
    if (!user) return;

    const checkSession = () => {
      if (!isValidSession(user)) {
        handleLogout();
        setError('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
      }
    };
    
    const interval = setInterval(checkSession, 60000);
    return () => clearInterval(interval);
  }, [user, isValidSession, handleLogout]);

  // ============================================================
  // FUNCIÓN: RENDERIZAR PANEL SEGÚN ROL (MEMOIZADO)
  // ============================================================
  const renderPanel = useMemo(() => {
    if (!user) return null;

    const userRole = user.role ? user.role.toUpperCase() : '';
    console.log("Rol del usuario:", userRole);
    console.log("Usuario completo:", user);

    if (userRole === 'USER') {
      return <EmployeePanel user={user} onLogout={handleLogout} apiUrl={API_URL} />;
    }

    if (userRole === 'ADMIN') {
      return <AdminPanel user={user} onLogout={handleLogout} apiUrl={API_URL} />;
    }

    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-zinc-900 p-6 rounded-2xl shadow-md text-center max-w-sm border border-zinc-800">
          <p className="text-zinc-400 font-medium mb-4">Rol no reconocido: "{user.role}"</p>
          <button 
            onClick={handleLogout} 
            className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
          >
            Volver al Login
          </button>
        </div>
      </div>
    );
  }, [user, handleLogout]);

  // ============================================================
  // RENDER: PANTALLA DE CARGA INICIAL
  // ============================================================
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
          <p className="text-zinc-400 font-medium text-sm">Cargando sesión...</p>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER PRINCIPAL
  // ============================================================
  return (
    <div className="relative">
      {/* OVERLAY DE CARGA */}
      {loading && (
        <div className="fixed inset-0 bg-zinc-900/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent mb-4"></div>
          <p className="font-medium text-sm text-zinc-400">Conectando...</p>
        </div>
      )}

      {/* ERROR TOAST */}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-rose-950/80 border border-rose-800/60 text-rose-300 px-4 py-3 rounded-xl shadow-lg z-50 text-sm font-medium flex items-center gap-2 backdrop-blur-sm max-w-[90%]">
          <span>⚠️</span> {error}
          <button 
            onClick={() => setError('')} 
            className="ml-3 font-bold hover:text-rose-100 transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* RENDER DEL PANEL SEGÚN ROL */}
      {!user ? (
        <Login onLoginSubmit={handleLoginSubmit} />
      ) : (
        renderPanel
      )}
    </div>
  );
}

export default App;