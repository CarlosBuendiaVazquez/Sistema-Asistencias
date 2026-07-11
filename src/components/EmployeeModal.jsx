import React, { useState, useEffect, useCallback } from 'react';

const EmployeeModal = React.memo(({ 
  isOpen, 
  isAdding, 
  employee, 
  onClose, 
  onSave,
  onShowPin,
  showPinForEmployee,
  user,
  apiUrl,
  setStatusMessage 
}) => {
  // Estado LOCAL del modal - Esto evita que el padre se re-renderice
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    pin: '',
    store: 'PENIEL',
    role: 'USER'
  });
  const [loading, setLoading] = useState(false);

  // Resetear formulario cuando se abre/cierra o cambia el empleado
  useEffect(() => {
    if (isOpen && employee) {
      setFormData({
        id: employee.id || '',
        name: employee.name || '',
        pin: employee.pin || '',
        store: employee.store || 'PENIEL',
        role: employee.role || 'USER'
      });
    } else if (isOpen && isAdding) {
      setFormData({
        id: '',
        name: '',
        pin: '',
        store: 'PENIEL',
        role: 'USER'
      });
    }
  }, [isOpen, employee, isAdding]);

  // Manejadores de cambios - Con useCallback para estabilidad
  const handleChange = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Manejador de guardado
  const handleSave = useCallback(async () => {
    if (!formData.id || !formData.name || !formData.pin) {
      if (setStatusMessage) {
        setStatusMessage({ 
          text: 'ID, Nombre y Contraseña son obligatorios.', 
          isError: true 
        });
      }
      return;
    }

    setLoading(true);
    try {
      const action = isAdding ? 'ADD_EMPLOYEE' : 'EDIT_EMPLOYEE';
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: action,
          id: formData.id.toUpperCase(),
          name: formData.name,
          pin: formData.pin,
          store: formData.store,
          role: formData.role
        })
      });

      const resData = await response.json();
      
      if (resData.success) {
        if (setStatusMessage) {
          setStatusMessage({ 
            text: isAdding ? 'Empleado agregado exitosamente.' : 'Empleado actualizado exitosamente.', 
            isError: false 
          });
        }
        onSave();
        onClose();
      } else {
        if (setStatusMessage) {
          setStatusMessage({ 
            text: 'Error: ' + (resData.error || 'No se pudo guardar el empleado.'), 
            isError: true 
          });
        }
      }
    } catch (err) {
      console.error(err);
      if (setStatusMessage) {
        setStatusMessage({ 
          text: 'Error de conexión al guardar el empleado.', 
          isError: true 
        });
      }
    } finally {
      setLoading(false);
    }
  }, [formData, isAdding, apiUrl, onSave, onClose, setStatusMessage]);

  // Manejador para mostrar PIN
  const handleShowPin = useCallback(() => {
    if (onShowPin && employee) {
      onShowPin(employee);
    }
  }, [onShowPin, employee]);

  if (!isOpen) return null;

  const title = isAdding ? 'Agregar Nuevo Empleado' : 'Editar Empleado';
  const storeOptions = ['PENIEL', 'EMAR', 'EBEN-EZER'];
  const roleOptions = ['USER', 'ADMIN'];
  const isPinVisible = showPinForEmployee === employee?.id;

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-zinc-900 rounded-xl border border-zinc-800 shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center flex-shrink-0">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded text-xs font-bold transition-colors"
            type="button"
          >
            Cerrar
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 block">
              ID de Empleado *
            </label>
            <input
              type="text"
              value={formData.id}
              onChange={(e) => handleChange('id', e.target.value)}
              disabled={!isAdding}
              className={`w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-orange-500 transition-all ${!isAdding ? 'opacity-60 cursor-not-allowed' : ''}`}
              placeholder="Ej. EMP011"
              autoFocus={isAdding}
            />
            {!isAdding && (
              <p className="text-[9px] text-zinc-500 mt-1">El ID no se puede modificar</p>
            )}
          </div>

          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 block">
              Nombre Completo *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-orange-500 transition-all"
              placeholder="Ej. Juan Perez"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 block">
              Contraseña *
            </label>
            <div className="relative">
              <input
                type={isPinVisible ? 'text' : 'password'}
                maxLength="10"
                value={formData.pin}
                onChange={(e) => handleChange('pin', e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-orange-500 transition-all pr-10"
                placeholder="Maximo 10 caracteres"
              />
              {!isAdding && employee && (
                <button
                  type="button"
                  onClick={handleShowPin}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors focus:outline-none"
                >
                  {isPinVisible ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 block">
              Sucursal
            </label>
            <select
              value={formData.store}
              onChange={(e) => handleChange('store', e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-orange-500 transition-all"
            >
              {storeOptions.map(store => (
                <option key={store} value={store}>{store}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 block">
              Rol
            </label>
            <select
              value={formData.role}
              onChange={(e) => handleChange('role', e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-orange-500 transition-all"
            >
              {roleOptions.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-bold transition-colors uppercase tracking-wider"
            type="button"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className={`px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-bold transition-colors uppercase tracking-wider ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            type="button"
          >
            {loading ? 'Guardando...' : (isAdding ? 'Agregar' : 'Guardar Cambios')}
          </button>
        </div>
      </div>
    </div>
  );
});

EmployeeModal.displayName = 'EmployeeModal';

export default EmployeeModal;