import React, { useState } from 'react';
import Login from './components/Login.jsx';
import EmployeePanel from './components/EmployeePanel.jsx';
import AdminPanel from './components/AdminPanel.jsx';

// URL del Google Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbzgSEmCuGP8NH4CBDuc6KDsqR53rIq6lhuScSdwn2eMicLK0gokPHn1FkIibgyYPLQSHg/exec";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLoginSubmit = async (employeeId, pin) => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain' }, 
        body: JSON.stringify({
          action: 'LOGIN',
          username: employeeId, // <-- CORREGIDO: Tu Apps Script espera "username"
          pin: pin
        })
      });

      const responseText = await response.text();
      console.log("Respuesta cruda de Google:", responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error("Google Apps Script devolvió un formato incorrecto. Revisa que esté bien publicado.");
      }

      if (data.success && data.user) {
        // Al hacer setUser, estructuramos explícitamente el objeto garantizando 
        // que pasen todas tus columnas de horario individual intactas
        setUser({
          id: data.user.id,
          name: data.user.name,
          store: data.user.store,
          role: data.user.role,
          scheduleIn: data.user.scheduleIn,
          scheduleOut: data.user.scheduleOut,
          rawLV: data.user.rawLV,     // Inyección dinámica del día actual de entre semana
          rawLun: data.user.rawLun,   // Lunes individual
          rawMar: data.user.rawMar,   // Martes individual
          rawMie: data.user.rawMie,   // Miércoles individual
          rawJue: data.user.rawJue,   // Jueves individual
          rawVie: data.user.rawVie,   // Viernes individual
          rawSab: data.user.rawSab,   // Sábado individual
          rawDom: data.user.rawDom,   // Domingo individual
          lastMovement: data.user.lastMovement
        });
      } else {
        setError(data.error || 'Credenciales inválidas o estructura de usuario incompleta.');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <div className="relative">
      {/* Pantalla de carga (Spinner) */}
      {loading && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
          <p className="font-medium text-sm">Conectando con la nube de la ferretería...</p>
        </div>
      )}

      {/* Alerta de errores global */}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl shadow-lg z-50 text-sm font-medium flex items-center gap-2">
          <span>⚠️</span> {error}
          <button onClick={() => setError('')} className="ml-3 font-bold hover:text-rose-900">✕</button>
        </div>
      )}

      {/* Enrutador de Vistas según el estado del usuario */}
      {(() => {
        if (!user) {
          return <Login onLoginSubmit={handleLoginSubmit} />;
        }

        const userRole = user.role ? user.role.toUpperCase() : '';

        if (userRole === 'USER') {
          return <EmployeePanel user={user} onLogout={handleLogout} apiUrl={API_URL} />;
        }

        if (userRole === 'ADMIN') {
          return <AdminPanel user={user} onLogout={handleLogout} apiUrl={API_URL} />;
        }

        return (
          <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-2xl shadow-md text-center max-w-sm">
              <p className="text-slate-600 font-medium mb-4">Rol de usuario no reconocido: "{user.role}"</p>
              <button onClick={handleLogout} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm">
                Volver al Login
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default App;