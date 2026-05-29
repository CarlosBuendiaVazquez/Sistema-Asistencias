import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

function BranchTotem() {
  const [selectedStore, setSelectedStore] = useState('');
  const stores = ['Sucursal Centro', 'Sucursal Norte', 'Sucursal Abastos'];

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white">
      <div className="max-w-md w-full bg-slate-800 rounded-3xl p-8 shadow-2xl border border-slate-700 text-center space-y-6">
        
        <div>
          <span className="text-4xl">🏢</span>
          <h1 className="text-2xl font-black mt-2 tracking-tight text-white">Estación de Asistencia QR</h1>
          <p className="text-sm text-slate-400 mt-1">Ferretería - Modo Tótem</p>
        </div>

        {!selectedStore ? (
          <div className="space-y-4 pt-4">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider text-left">
              Selecciona la ubicación de este Tótem:
            </label>
            <div className="flex flex-col gap-2">
              {stores.map((store) => (
                <button
                  key={store}
                  onClick={() => setSelectedStore(store)}
                  className="w-full bg-slate-700 hover:bg-blue-600 text-slate-200 font-semibold py-3.5 px-4 rounded-xl transition-all text-sm border border-slate-600 text-left flex justify-between items-center"
                >
                  <span>{store}</span>
                  <span>➔</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-blue-600/10 border border-blue-500/30 rounded-2xl py-2 px-4 inline-block">
              <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">
                📍 Ubicación: {selectedStore}
              </p>
            </div>

            {/* Renderizado del código QR */}
            <div className="bg-white p-6 rounded-2xl inline-block shadow-lg border-4 border-slate-600">
              <QRCodeSVG 
                value={JSON.stringify({
                  type: "FERRE_QR_AUTH",
                  store: selectedStore,
                  generatedAt: new Date().toISOString().split('T')[0] // Cambia cada día para evitar fraude con fotos viejas
                })}
                size={220}
                bgColor={"#FFFFFF"}
                fgColor={"#0f172a"}
                level={"H"} // Alta tolerancia a daños o reflejos en la pantalla
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-300">
                Escanea este código desde tu celular para checar entrada o salida.
              </p>
            </div>

            <button
              onClick={() => setSelectedStore('')}
              className="text-xs text-slate-500 hover:text-rose-400 font-medium pt-4 transition-colors underline block mx-auto"
            >
              Cambiar de sucursal
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default BranchTotem;