import React, { useState } from 'react';

function Login({ onLoginSubmit }) {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username || !pin) return;
    onLoginSubmit(username, pin);
  };

  const toggleShowPin = () => {
    setShowPin(!showPin);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-3 md:p-4">
      <div className="bg-zinc-900 w-full max-w-sm rounded-2xl shadow-2xl border border-zinc-800 p-4 md:p-6">
        <div className="text-center mb-4 md:mb-6">
          <div className="bg-orange-900/20 text-orange-500 w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center text-xl md:text-2xl mx-auto mb-2 shadow-sm font-bold border border-orange-500/20">
            🛠️
          </div>
          <h2 className="text-lg md:text-xl font-black text-white tracking-tight">Control de Asistencia</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 px-1">
              Usuario
            </label>
            <input 
              type="text" 
              placeholder="Ej. EMP001"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 md:py-3 text-sm font-medium text-white placeholder-zinc-700 focus:outline-none focus:border-orange-500 transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 px-1">
              Contraseña
            </label>
            <div className="relative">
              <input 
                type={showPin ? 'text' : 'password'}
                maxLength="10"
                placeholder="Ingresa tu contraseña"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 md:py-3 text-sm font-medium text-white placeholder-zinc-700 focus:outline-none focus:border-orange-500 transition-all pr-10"
                required
              />
              <button
                type="button"
                onClick={toggleShowPin}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors focus:outline-none"
                tabIndex="-1"
                aria-label={showPin ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPin ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-[9px] text-zinc-500 mt-0.5 px-1">
              Máximo 10 caracteres (letras, números y símbolos)
            </p>
          </div>

          <button 
            type="submit"
            className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 md:py-3.5 rounded-xl shadow-lg shadow-orange-900/20 transition-all text-xs uppercase tracking-widest mt-1 active:scale-[0.98]"
          >
            Ingresar
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;