import React, { useState } from 'react';

function Login({ onLoginSubmit }) {
  const [id, setId] = useState('');
  const [pin, setPin] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!id || !pin) return;
    onLoginSubmit(id, pin);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="bg-zinc-900 w-full max-w-md rounded-3xl shadow-2xl border border-zinc-800 p-8">
        <div className="text-center mb-8">
          <div className="bg-orange-900/20 text-orange-500 w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3 shadow-sm font-bold border border-orange-500/20">
            🛠️
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Control de Asistencia</h2>
          <p className="text-sm text-zinc-500 mt-1">Grupo Ferretero - Registro de Jornada</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 px-1">ID de Empleado</label>
            <input 
              type="text" 
              placeholder="Ej. EMP001"
              value={id}
              onChange={(e) => setId(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-base font-medium text-white placeholder-zinc-700 focus:outline-none focus:border-orange-500 transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 px-1">PIN de Seguridad</label>
            <input 
              type="password" 
              maxLength="4"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-center font-mono text-3xl tracking-[0.5em] text-white placeholder-zinc-700 focus:outline-none focus:border-orange-500 transition-all"
              required
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-5 rounded-2xl shadow-lg shadow-orange-900/20 transition-all text-xs uppercase tracking-widest mt-2 active:scale-[0.98]"
          >
            Ingresar al Sistema
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;