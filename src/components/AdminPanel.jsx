import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import EmployeeModal from './EmployeeModal';

function AdminPanel({ user, onLogout, apiUrl }) {
  const [allRecords, setAllRecords] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState({ text: '', isError: false });

  // Pestañas Principales
  const [activeTab, setActiveTab] = useState('GENERAL');

  // Filtros de Bitácora
  const [searchQuery, setSearchQuery] = useState('');
  const [movementFilter, setMovementFilter] = useState('TODOS');
  const [dateMode, setDateMode] = useState('SINGLE');
  const [singleDate, setSingleDate] = useState(() => {
    const hoy = new Date();
    const dia = String(hoy.getDate()).padStart(2, '0');
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    return `${hoy.getFullYear()}-${mes}-${dia}`;
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Estados para la Paginación de la Bitácora
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const recordsPerPage = 30;

  // Generador QR
  const [qrStoreTarget, setQrStoreTarget] = useState('PENIEL');
  const [generatedJson, setGeneratedJson] = useState('');

  // Estados para Edición de Horas en Bitácora
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [editingTimeValue, setEditingTimeValue] = useState('');
  const [editingCommentValue, setEditingCommentValue] = useState('');

  // Estado para alternar la visibilidad de los comentarios
  const [expandedComments, setExpandedComments] = useState({});

  // Módulo Control de Horas Semanales
  const [semanaSeleccionada, setSemanaSeleccionada] = useState('EN_VIVO');
  const [listaSemanasHistoricas, setListaSemanasHistoricas] = useState([]);
  const [reporteHoras, setReporteHoras] = useState([]);
  const [infoSemana, setInfoSemana] = useState({ fechaInicio: '', fechaFin: '', estatusCorte: '' });
  const [loadingHoras, setLoadingHoras] = useState(false);

  // Filtros dinámicos para la pestaña de Control de Horas
  const [hoursSearchQuery, setHoursSearchQuery] = useState('');
  const [hoursConditionFilter, setHoursConditionFilter] = useState('TODOS');

  // --- ESTADO PARA MODAL DE EDICIÓN DE HORARIO ---
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingEmployeeForSchedule, setEditingEmployeeForSchedule] = useState(null);
  const [scheduleEditData, setScheduleEditData] = useState({
    Lunes: { isLaborable: true, in: '10:00', out: '19:00' },
    Martes: { isLaborable: true, in: '10:00', out: '19:00' },
    Miércoles: { isLaborable: true, in: '10:00', out: '19:00' },
    Jueves: { isLaborable: true, in: '10:00', out: '19:00' },
    Viernes: { isLaborable: true, in: '10:00', out: '19:00' },
    Sábado: { isLaborable: true, in: '08:00', out: '19:00' },
    Domingo: { isLaborable: true, in: '08:00', out: '15:00' },
  });

  // --- ESTADOS PARA MODAL DE GESTION DE VACACIONES ---
  const [showVacationModal, setShowVacationModal] = useState(false);
  const [selectedEmployeeForVacations, setSelectedEmployeeForVacations] = useState(null);
  const [employeeVacations, setEmployeeVacations] = useState([]);
  const [loadingVacations, setLoadingVacations] = useState(false);
  const [editingVacationId, setEditingVacationId] = useState(null);
  const [vacationEditData, setVacationEditData] = useState({
    startDate: '',
    endDate: '',
  });

  // --- ESTADOS PARA ASIGNAR NUEVAS VACACIONES (desde el modal) ---
  const [showNewVacationForm, setShowNewVacationForm] = useState(false);
  const [newVacationStart, setNewVacationStart] = useState('');
  const [newVacationEnd, setNewVacationEnd] = useState('');

  // --- ESTADOS PARA CRUD DE EMPLEADOS ---
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  
  // --- ESTADO PARA VER CONTRASEÑA (requiere validación de admin) ---
  const [showPinForEmployee, setShowPinForEmployee] = useState(null);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [showAdminPinDialog, setShowAdminPinDialog] = useState(false);
  const [pendingEmployeeForPin, setPendingEmployeeForPin] = useState(null);

  // --- ESTADO PARA CONTROL DE RECARGA ---
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- ESTADO PARA DIÁLOGO DE CONFIRMACIÓN ---
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmEmployee, setConfirmEmployee] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');

  // ============================================================
  // FUNCIONES DE UTILIDAD
  // ============================================================
  const toggleComment = useCallback((recordId) => {
    setExpandedComments(prev => ({
      ...prev,
      [recordId]: !prev[recordId]
    }));
  }, []);

  const formatShortModifiedDate = (dateStr) => {
    if (!dateStr) return 'Sin registros previos';
    let cleanStr = String(dateStr).trim();
    if (cleanStr === 'Recién modificado') return cleanStr;

    try {
      const date = new Date(cleanStr);
      if (isNaN(date.getTime())) return cleanStr;

      const dia = String(date.getDate()).padStart(2, '0');
      const mes = String(date.getMonth() + 1).padStart(2, '0');
      const anio = date.getFullYear();
      const horas = String(date.getHours()).padStart(2, '0');
      const minutos = String(date.getMinutes()).padStart(2, '0');

      return `${dia}/${mes}/${anio} ${horas}:${minutos}`;
    } catch (e) {
      return cleanStr;
    }
  };

  const formatDateForDisplay = (dateStr) => {
    if (!dateStr) return 'No definida';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const getValueByStrategy = (obj, searchKeys, fallbackIndex, fallback = '') => {
    if (!obj) return fallback;
    for (let key of searchKeys) {
      if (obj[key] !== undefined && obj[key] !== null) return String(obj[key]).trim();
    }
    const values = Object.values(obj);
    return (values[fallbackIndex] !== undefined && values[fallbackIndex] !== null) ? String(values[fallbackIndex]).trim() : fallback;
  };

  const parseStringToLocalDate = (dateStr) => {
    if (!dateStr) return null;
    const cleanDate = dateStr.split('T')[0].trim();
    const parts = cleanDate.split(/[-/]/);
    if (parts.length !== 3) return null;
    let year, month, day;
    if (parts[0].length === 4) [year, month, day] = parts;
    else [day, month, year] = parts;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0);
  };

  const formatDatePickerString = (fechaStr) => {
    if (!fechaStr) return '';
    const [year, month, day] = fechaStr.split('-');
    return `${day}/${month}/${year}`;
  };

  // ============================================================
  // FUNCIÓN PRINCIPAL OPTIMIZADA PARA OBTENER DATOS
  // ============================================================
  const fetchAdminData = useCallback(async (page = currentPage, preservePage = false, showMessage = true) => {
    setLoading(true);
    setIsRefreshing(true);
    
    try {
      // Construir parámetros para la API optimizada
      const params = new URLSearchParams();
      params.append('action', 'GET_ADMIN_DATA_OPTIMIZED');
      params.append('page', page);
      params.append('limit', recordsPerPage);
      
      // Filtros
      if (activeTab !== 'GENERAL' && activeTab !== 'PERSONAL' && activeTab !== 'HORAS') {
        params.append('store', activeTab);
      }
      
      if (searchQuery) params.append('search', searchQuery);
      if (movementFilter !== 'TODOS') params.append('movement', movementFilter);
      
      if (dateMode === 'SINGLE' && singleDate) {
        params.append('dateStart', singleDate);
        params.append('dateEnd', singleDate);
      } else if (dateMode === 'RANGE') {
        if (startDate) params.append('dateStart', startDate);
        if (endDate) params.append('dateEnd', endDate);
      }
      
      const cacheBuster = new Date().getTime();
      const url = `${apiUrl}?${params.toString()}&_cb=${cacheBuster}`;
      
      const response = await fetch(url);
      const resData = await response.json();

      if (resData.success) {
        // Actualizar registros paginados
        setAllRecords(resData.records || []);
        setTotalRecords(resData.totalRecords || 0);
        setTotalPages(resData.totalPages || 1);
        
        if (!preservePage) {
          setCurrentPage(resData.currentPage || 1);
        }

        // Actualizar lista de empleados
        if (resData.employees) {
          const processedEmployees = resData.employees.map(emp => {
            let activeVacation = null;

            if (emp.vacations) {
              const vacationId = emp.vacations.id ||
                emp.vacations.vacationId ||
                emp.vacations.ID ||
                emp.vacations.idVacacion ||
                emp.vacations.vacation_Id;

              if (vacationId) {
                activeVacation = {
                  id: String(vacationId),
                  vacationId: String(vacationId),
                  start: emp.vacations.start || emp.vacations.startDate || emp.vacations.Fecha_Inicio || '',
                  end: emp.vacations.end || emp.vacations.endDate || emp.vacations.Fecha_Fin || '',
                  status: emp.vacations.status || 'ACTIVO',
                  notes: emp.vacations.notes || emp.vacations.comment || emp.vacations.Comentario || ''
                };
              }
            }

            if (emp.onVacation === true && !activeVacation) {
              let vacId = null;
              if (typeof emp.onVacation === 'object' && emp.onVacation !== null) {
                vacId = emp.onVacation.id || emp.onVacation.vacationId || emp.onVacation.ID;
              }

              activeVacation = {
                id: vacId || 'VAC-' + Date.now(),
                vacationId: vacId || 'VAC-' + Date.now(),
                start: '',
                end: '',
                status: 'ACTIVO',
                notes: 'Vacaciones activas (detalles no disponibles)'
              };
            }

            return {
              ...emp,
              vacations: activeVacation,
              onVacation: emp.onVacation === true || emp.onVacation === 'true' || !!activeVacation
            };
          });
          setEmployeesList(processedEmployees);
        }

        // Solo mostrar mensaje si showMessage es true
        if (showMessage) {
          setStatusMessage({
            text: 'Datos sincronizados correctamente',
            isError: false
          });
          setTimeout(() => {
            setStatusMessage({ text: '', isError: false });
          }, 3000);
        }
      } else {
        setStatusMessage({ text: 'No se pudieron recuperar los datos de Google Sheets.', isError: true });
      }
    } catch (err) {
      console.error(err);
      setStatusMessage({ text: 'Error de conexion con el servidor de Google.', isError: true });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [apiUrl, activeTab, searchQuery, movementFilter, dateMode, singleDate, startDate, endDate, currentPage, recordsPerPage]);

  // ============================================================
  // FUNCIÓN PARA CARGAR CONTROL DE HORAS (OPTIMIZADA)
  // ============================================================
  const loadHoursReport = useCallback(async () => {
    setLoadingHoras(true);
    try {
      const res = await fetch(`${apiUrl}?action=GET_WEEKLY_HOURS&semanaId=${semanaSeleccionada}&_cb=${new Date().getTime()}`);
      const data = await res.json();

      if (data.success) {
        const reporteFiltrado = (data.reporte || []).filter(emp => {
          const empInfo = employeesList.find(e => e.id.toUpperCase() === emp.id.toUpperCase());
          return empInfo && empInfo.role !== 'ADMIN';
        });
        setReporteHoras(reporteFiltrado);
        setInfoSemana({
          fechaInicio: data.fechaInicio || '',
          fechaFin: data.fechaFin || '',
          estatusCorte: data.estatusCorte || ''
        });
      }
    } catch (err) {
      console.error("Error obtaining hours report:", err);
    } finally {
      setLoadingHoras(false);
    }
  }, [apiUrl, semanaSeleccionada, employeesList]);

  // ============================================================
  // FUNCIONES PARA EL MODAL DE VACACIONES
  // ============================================================
  const openVacationModal = async (employee) => {
    setSelectedEmployeeForVacations(employee);
    setShowVacationModal(true);
    setShowNewVacationForm(false);
    setEditingVacationId(null);
    setVacationEditData({ startDate: '', endDate: '' });

    await loadEmployeeVacations(employee.id);
  };

  const loadEmployeeVacations = async (employeeId) => {
    setLoadingVacations(true);
    try {
      const response = await fetch(`${apiUrl}?action=GET_EMPLOYEE_VACATIONS&employeeId=${employeeId}&_cb=${new Date().getTime()}`);
      const data = await response.json();

      if (data.success) {
        setEmployeeVacations(data.vacations || []);
      } else {
        setStatusMessage({ text: 'Error al cargar vacaciones: ' + (data.error || ''), isError: true });
      }
    } catch (err) {
      console.error('Error loading vacations:', err);
      setStatusMessage({ text: 'Error de conexion al cargar vacaciones.', isError: true });
    } finally {
      setLoadingVacations(false);
    }
  };

  const handleSaveNewVacationFromModal = async () => {
    if (!selectedEmployeeForVacations) return;

    if (!newVacationStart || !newVacationEnd) {
      setStatusMessage({ text: 'Selecciona fecha de inicio y fin.', isError: true });
      return;
    }

    if (newVacationStart > newVacationEnd) {
      setStatusMessage({ text: 'La fecha de inicio no puede ser mayor a la fecha de fin.', isError: true });
      return;
    }

    try {
      setLoadingVacations(true);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'REGISTER_VACATIONS',
          employeeId: selectedEmployeeForVacations.id,
          startDate: newVacationStart,
          endDate: newVacationEnd,
        })
      });

      const data = await response.json();

      if (data.success) {
        setStatusMessage({ text: 'Vacaciones registradas correctamente.', isError: false });
        setShowNewVacationForm(false);
        setNewVacationStart('');
        setNewVacationEnd('');
        await loadEmployeeVacations(selectedEmployeeForVacations.id);
        await fetchAdminData(currentPage, true, false);
      } else {
        setStatusMessage({ text: 'Error al guardar: ' + (data.error || ''), isError: true });
      }
    } catch (err) {
      console.error('Error saving vacation:', err);
      setStatusMessage({ text: 'Error de conexion al guardar.', isError: true });
    } finally {
      setLoadingVacations(false);
    }
  };

  const startEditVacation = (vacation) => {
    setEditingVacationId(vacation.id);
    setVacationEditData({
      startDate: vacation.startDate || '',
      endDate: vacation.endDate || '',
    });
  };

  const handleSaveEditVacation = async () => {
    if (!editingVacationId) return;

    if (!vacationEditData.startDate || !vacationEditData.endDate) {
      setStatusMessage({ text: 'Selecciona fecha de inicio y fin.', isError: true });
      return;
    }

    if (vacationEditData.startDate > vacationEditData.endDate) {
      setStatusMessage({ text: 'La fecha de inicio no puede ser mayor a la fecha de fin.', isError: true });
      return;
    }

    try {
      setLoadingVacations(true);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'EDIT_VACATION',
          vacationId: editingVacationId,
          startDate: vacationEditData.startDate,
          endDate: vacationEditData.endDate,
        })
      });

      const data = await response.json();

      if (data.success) {
        setStatusMessage({ text: 'Vacaciones actualizadas correctamente.', isError: false });
        setEditingVacationId(null);
        setVacationEditData({ startDate: '', endDate: '' });
        await loadEmployeeVacations(selectedEmployeeForVacations.id);
        await fetchAdminData(currentPage, true, false);
      } else {
        setStatusMessage({ text: 'Error al editar: ' + (data.error || ''), isError: true });
      }
    } catch (err) {
      console.error('Error editing vacation:', err);
      setStatusMessage({ text: 'Error de conexion al editar.', isError: true });
    } finally {
      setLoadingVacations(false);
    }
  };

  const cancelEditVacation = () => {
    setEditingVacationId(null);
    setVacationEditData({ startDate: '', endDate: '' });
  };

  const handleDeleteVacationFromModal = async (vacation) => {
    const empName = selectedEmployeeForVacations?.name || selectedEmployeeForVacations?.id || 'empleado';

    setConfirmMessage(`Eliminar las vacaciones de ${empName} (${formatDateForDisplay(vacation.startDate)} al ${formatDateForDisplay(vacation.endDate)})?`);
    setConfirmEmployee(selectedEmployeeForVacations);
    setConfirmAction(() => async () => {
      await executeDeleteVacation(vacation.id);
    });
    setShowConfirmDialog(true);
  };

  const executeDeleteVacation = async (vacationId) => {
    if (!selectedEmployeeForVacations) return;

    try {
      setLoadingVacations(true);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'DELETE_VACATION',
          employeeId: selectedEmployeeForVacations.id,
          vacationId: vacationId
        })
      });

      const data = await response.json();

      if (data.success) {
        setStatusMessage({ text: 'Vacaciones eliminadas correctamente.', isError: false });
        setShowConfirmDialog(false);
        setConfirmEmployee(null);
        setConfirmAction(null);
        await loadEmployeeVacations(selectedEmployeeForVacations.id);
        await fetchAdminData(currentPage, true, false);
      } else {
        setStatusMessage({ text: 'Error al eliminar: ' + (data.error || ''), isError: true });
      }
    } catch (err) {
      console.error('Error deleting vacation:', err);
      setStatusMessage({ text: 'Error de conexion al eliminar.', isError: true });
    } finally {
      setLoadingVacations(false);
    }
  };

  // ============================================================
  // FUNCIONES PARA EL MODAL DE EDICION DE HORARIO
  // ============================================================
  const openScheduleModal = (employee) => {
    if (employee.onVacation) {
      setStatusMessage({
        text: `El empleado ${employee.name} está de vacaciones. No se puede editar su horario.`,
        isError: true
      });
      return;
    }

    setEditingEmployeeForSchedule(employee);
    setShowScheduleModal(true);

    const parseDayStr = (str) => {
      if (!str || str.toUpperCase().includes('DESCANSO') || str === '-') {
        return { isLaborable: false, in: '09:00', out: '18:00' };
      }
      const parts = str.split('-');
      return {
        isLaborable: true,
        in: parts[0] ? parts[0].trim() : '09:00',
        out: parts[1] ? parts[1].trim() : '18:00'
      };
    };

    setScheduleEditData({
      Lunes: parseDayStr(employee.rawLun),
      Martes: parseDayStr(employee.rawMar),
      Miércoles: parseDayStr(employee.rawMie),
      Jueves: parseDayStr(employee.rawJue),
      Viernes: parseDayStr(employee.rawVie),
      Sábado: parseDayStr(employee.rawSab),
      Domingo: parseDayStr(employee.rawDom),
    });
  };

  const handleSaveSchedule = async () => {
    if (!editingEmployeeForSchedule) return;

    try {
      setLoading(true);

      const payloadSchedule = {
        action: 'UPDATE_EMPLOYEE_SCHEDULE_FLEX',
        employeeId: editingEmployeeForSchedule.id,
        rawLunIn: scheduleEditData.Lunes.isLaborable ? scheduleEditData.Lunes.in : 'DESCANSO',
        rawLunOut: scheduleEditData.Lunes.isLaborable ? scheduleEditData.Lunes.out : 'DESCANSO',
        rawMarIn: scheduleEditData.Martes.isLaborable ? scheduleEditData.Martes.in : 'DESCANSO',
        rawMarOut: scheduleEditData.Martes.isLaborable ? scheduleEditData.Martes.out : 'DESCANSO',
        rawMieIn: scheduleEditData.Miércoles.isLaborable ? scheduleEditData.Miércoles.in : 'DESCANSO',
        rawMieOut: scheduleEditData.Miércoles.isLaborable ? scheduleEditData.Miércoles.out : 'DESCANSO',
        rawJueIn: scheduleEditData.Jueves.isLaborable ? scheduleEditData.Jueves.in : 'DESCANSO',
        rawJueOut: scheduleEditData.Jueves.isLaborable ? scheduleEditData.Jueves.out : 'DESCANSO',
        rawVieIn: scheduleEditData.Viernes.isLaborable ? scheduleEditData.Viernes.in : 'DESCANSO',
        rawVieOut: scheduleEditData.Viernes.isLaborable ? scheduleEditData.Viernes.out : 'DESCANSO',
        rawSabIn: scheduleEditData.Sábado.isLaborable ? scheduleEditData.Sábado.in : 'DESCANSO',
        rawSabOut: scheduleEditData.Sábado.isLaborable ? scheduleEditData.Sábado.out : 'DESCANSO',
        rawDomIn: scheduleEditData.Domingo.isLaborable ? scheduleEditData.Domingo.in : 'DESCANSO',
        rawDomOut: scheduleEditData.Domingo.isLaborable ? scheduleEditData.Domingo.out : 'DESCANSO',
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payloadSchedule)
      });
      const resData = await response.json();

      if (resData.success) {
        setShowScheduleModal(false);
        setEditingEmployeeForSchedule(null);
        await fetchAdminData(currentPage, true, false);
        setStatusMessage({
          text: `Esquema de disponibilidad semanal actualizado con exito.`,
          isError: false
        });
      } else {
        alert("Error al guardar esquema: " + resData.error);
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al guardar los horarios.");
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleDayChange = (day, field, value) => {
    setScheduleEditData(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }));
  };

  // ============================================================
  // FUNCIONES DE IMPRESION QR Y EDICION DE REGISTROS
  // ============================================================
  const handlePrintQR = () => {
    const canvas = document.querySelector('#qr-print-zone canvas');
    if (!canvas) {
      alert("Error: No se encontró el código QR para imprimir.");
      return;
    }
    const qrImageSrc = canvas.toDataURL("image/png");
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir QR - Control de Asistencias</title>
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 90vh; margin: 0; text-align: center; }
            img { width: 260px; height: 260px; margin-bottom: 20px; }
            h1 { font-size: 22px; margin: 0; color: #000; letter-spacing: 1px; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <img src="${qrImageSrc}" />
          <h1>SUCURSAL: ${qrStoreTarget}</h1>
          <script>
            window.onload = function() { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSaveTimeEdit = async (recordId) => {
    if (!editingTimeValue) return;
    try {
      setLoading(true);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'EDIT_RECORD',
          recordId: recordId,
          newTime: editingTimeValue,
          comment: editingCommentValue || 'Modificado por el Administrador'
        })
      });
      const resData = await response.json();
      if (resData.success) {
        setEditingRecordId(null);
        setEditingTimeValue('');
        setEditingCommentValue('');
        await fetchAdminData(currentPage, true, false);
        setStatusMessage({ text: 'Registro editado correctamente.', isError: false });
      } else {
        alert("Error al editar registro: " + resData.error);
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al intentar editar.");
    }
    setLoading(false);
  };

  // ============================================================
  // FUNCIONES PARA CRUD DE EMPLEADOS
  // ============================================================
  const openAddEmployeeModal = () => {
    setEditingEmployee(null);
    setIsAddingEmployee(true);
    setShowEmployeeModal(true);
  };

  const openEditEmployeeModal = (employee) => {
    setEditingEmployee(employee);
    setIsAddingEmployee(false);
    setShowEmployeeModal(true);
  };

  const handleDeleteEmployee = async (employee) => {
    if (employee.id === 'EMP001') {
      setStatusMessage({ 
        text: 'No se puede eliminar al administrador principal.', 
        isError: true 
      });
      return;
    }

    setConfirmMessage(`Eliminar al empleado ${employee.name} (ID: ${employee.id})?`);
    setConfirmEmployee(employee);
    setConfirmAction(() => async () => {
      await executeDeleteEmployee(employee.id);
    });
    setShowConfirmDialog(true);
  };

  const executeDeleteEmployee = async (employeeId) => {
    try {
      setLoading(true);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'DELETE_EMPLOYEE',
          id: employeeId
        })
      });

      const resData = await response.json();
      
      if (resData.success) {
        setStatusMessage({ 
          text: 'Empleado eliminado exitosamente.', 
          isError: false 
        });
        setShowConfirmDialog(false);
        await fetchAdminData(currentPage, true, false);
      } else {
        setStatusMessage({ 
          text: 'Error: ' + (resData.error || 'No se pudo eliminar el empleado.'), 
          isError: true 
        });
      }
    } catch (err) {
      console.error(err);
      setStatusMessage({ 
        text: 'Error de conexión al eliminar el empleado.', 
        isError: true 
      });
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // FUNCIONES PARA VER CONTRASEÑA CON VALIDACIÓN DE ADMIN
  // ============================================================
  const handleShowPin = (employee) => {
    setPendingEmployeeForPin(employee);
    setAdminPinInput('');
    setShowAdminPinDialog(true);
  };

  const handleHidePin = () => {
    setShowPinForEmployee(null);
  };

  const validateAdminPin = async () => {
    if (!adminPinInput.trim()) {
      setStatusMessage({ text: 'Ingresa la contraseña de administrador.', isError: true });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'LOGIN',
          username: user.id,
          pin: adminPinInput.trim()
        })
      });

      const resData = await response.json();
      
      if (resData.success && resData.user) {
        setShowAdminPinDialog(false);
        setShowPinForEmployee(pendingEmployeeForPin?.id);
        setAdminPinInput('');
        setStatusMessage({ text: 'Contraseña verificada correctamente.', isError: false });
        setTimeout(() => setStatusMessage({ text: '', isError: false }), 3000);
      } else {
        setStatusMessage({ text: 'Contraseña de administrador incorrecta.', isError: true });
        setAdminPinInput('');
      }
    } catch (err) {
      console.error(err);
      setStatusMessage({ text: 'Error al verificar la contraseña.', isError: true });
    } finally {
      setLoading(false);
    }
  };

  const closeAdminPinDialog = () => {
    setShowAdminPinDialog(false);
    setAdminPinInput('');
    setPendingEmployeeForPin(null);
  };

  // ============================================================
  // FUNCION PARA VERIFICAR RETARDO
  // ============================================================
  const checkIsLate = useCallback((recordTimeStr, employeeId, recordDateStr) => {
    if (!recordTimeStr || recordTimeStr === '--:--' || !employeeId || !recordDateStr) return false;

    const targetEmp = employeesList.find(e => String(e.id).toUpperCase() === String(employeeId).toUpperCase());
    if (!targetEmp) return false;

    const recordDateObj = parseStringToLocalDate(recordDateStr);
    if (!recordDateObj) return false;

    const diasSemanaCampos = ['rawDom', 'rawLun', 'rawMar', 'rawMie', 'rawJue', 'rawVie', 'rawSab'];
    const diaPropiedad = diasSemanaCampos[recordDateObj.getDay()];
    const horarioDiaString = targetEmp[diaPropiedad];

    if (!horarioDiaString || horarioDiaString.toUpperCase().includes('DESCANSO') || horarioDiaString === '-') return false;

    const fontHoraPermitidaStr = horarioDiaString.split('-')[0].trim();

    const timeToMinutes = (str) => {
      const parts = str.split(':');
      if (parts.length < 2) return 0;
      return (parseInt(parts[0], 10) * 60) + parseInt(parts[1], 10);
    };

    const minutesOfRecord = timeToMinutes(recordTimeStr);
    const minutesLimitAllowed = timeToMinutes(fontHoraPermitidaStr);

    return minutesOfRecord > (minutesLimitAllowed + 15);
  }, [employeesList]);

  // ============================================================
  // FILTRAR EMPLEADOS NO ADMIN PARA MÉTRICAS
  // ============================================================
  const nonAdminEmployees = useMemo(() => {
    return employeesList.filter(emp => emp.role !== 'ADMIN');
  }, [employeesList]);

  // ============================================================
  // EFECTOS Y HOOKS
  // ============================================================
  useEffect(() => {
    if (activeTab !== 'HORAS') return;

    const cargarHistoricoSemanas = async () => {
      try {
        const res = await fetch(`${apiUrl}?action=GET_HISTORIC_WEEKS_LIST&_cb=${new Date().getTime()}`);
        const data = await res.json();
        if (data.success) {
          setListaSemanasHistoricas(data.weeks || []);
        }
      } catch (err) {
        console.error("Error cargando lista de semanas:", err);
      }
    };
    cargarHistoricoSemanas();
  }, [activeTab, apiUrl]);

  // Cargar reporte de horas - Optimizado
  useEffect(() => {
    if (activeTab !== 'HORAS') return;
    loadHoursReport();
  }, [activeTab, semanaSeleccionada, loadHoursReport]);

  // Carga inicial - SIN mensaje automático
  useEffect(() => {
    fetchAdminData(1, false, false);
  }, []);

  // Cambio de página - SIN mensaje automático
  useEffect(() => {
    if (currentPage > 1) {
      fetchAdminData(currentPage, true, false);
    }
  }, [currentPage]);

  // Cambio de filtros - SIN mensaje automático
  useEffect(() => {
    setCurrentPage(1);
    fetchAdminData(1, false, false);
  }, [searchQuery, movementFilter, dateMode, singleDate, startDate, endDate, activeTab]);

  useEffect(() => {
    const qrPayload = {
      type: "FERRE_QR_AUTH",
      store: qrStoreTarget
    };
    setGeneratedJson(JSON.stringify(qrPayload));
  }, [qrStoreTarget]);

  // ============================================================
  // FILTRADO EN MEMORIA (para la vista actual de la página)
  // ============================================================
  const currentRecordsToDisplay = useMemo(() => {
    return allRecords;
  }, [allRecords]);

  const obtenerPersonalLaborandoHoy = useCallback(() => {
    const hoy = new Date();
    const dia = String(hoy.getDate()).padStart(2, '0');
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const hoyStr = `${hoy.getFullYear()}-${mes}-${dia}`;

    const asistenciasDeHoy = allRecords.filter(rec => {
      const recDateRaw = getValueByStrategy(rec, ["Fecha", "fecha"], 2, '');
      const recDateClean = String(recDateRaw).split('T')[0].trim();
      const recordDateObj = parseStringToLocalDate(recDateClean);
      if (!recordDateObj) return false;
      const targetDateObj = parseStringToLocalDate(hoyStr);
      return recordDateObj.getTime() === targetDateObj.getTime();
    });

    const ultimoEstadoPorEmpleado = {};

    [...asistenciasDeHoy].reverse().forEach(rec => {
      let empId = 'N/A';
      if (rec["ID Empleado"]) empId = String(rec["ID Empleado"]).trim().toUpperCase();
      else if (rec["ID_Empleado"]) empId = String(rec["ID_Empleado"]).trim().toUpperCase();
      else empId = getValueByStrategy(rec, [], 1, 'N/A').toUpperCase();

      const recStore = getValueByStrategy(rec, ["Sucursal", "store"], 5, 'PENIEL').toUpperCase();
      const recMov = getValueByStrategy(rec, ["Movimiento", "movimiento"], 4, '').toUpperCase().replace(/[\s_\-]/g, '');

      if (activeTab === 'GENERAL' || recStore === activeTab) {
        if (empId && empId !== 'N/A') {
          const empInfo = employeesList.find(e => e.id.toUpperCase() === empId);
          if (empInfo && empInfo.role === 'ADMIN') return;
          ultimoEstadoPorEmpleado[empId] = recMov;
        }
      }
    });

    let contadoresTrabajando = 0;
    Object.values(ultimoEstadoPorEmpleado).forEach(movimiento => {
      if (movimiento === 'ENTRADA' || movimiento === 'ENTRADATEMPORAL') {
        contadoresTrabajando++;
      }
    });

    return contadoresTrabajando;
  }, [allRecords, activeTab, employeesList]);

  // ============================================================
  // FUNCIONES DE EXPORTACION PDF
  // ============================================================
  const handleExportToPDF = () => {
    if (allRecords.length === 0) {
      alert("No hay registros en la vista actual para exportar.");
      return;
    }

    const printWindow = window.open('', '_blank');

    const tableRowsHtml = allRecords.map((rec) => {
      const empIdValue = getValueByStrategy(rec, ["ID Empleado", "ID_Empleado", "Empleado ID"], 1, 'N/A');
      const targetEmpObj = employeesList.find(e => String(e.id).toUpperCase() === String(empIdValue).toUpperCase());
      const empName = targetEmpObj ? targetEmpObj.name : 'Personal Activo';
      const store = getValueByStrategy(rec, ["Sucursal"], 5, 'PENIEL');
      const movement = getValueByStrategy(rec, ["Movimiento", "movimiento"], 4, 'ENTRADA');
      const date = getValueByStrategy(rec, ["Fecha", "fecha"], 2, '--/--/----');
      const time = getValueByStrategy(rec, ["Hora", "hora"], 3, '--:--');

      const comment = getValueByStrategy(rec, ["Justificacion", "justificacion", "Justificación"], 8, '');
      const modPropValue = getValueByStrategy(rec, ["Modificacion", "Modificación"], 6, 'FALSE');
      const isEdited = modPropValue.toUpperCase() === 'TRUE';

      const esRetardo = movement.toUpperCase().includes('ENTRADA') && !movement.toUpperCase().includes('TEMPORAL') && checkIsLate(time, empIdValue, date);

      return `
        <tr>
          <td>
            <div style="font-weight: bold; color: #111;">${empName}</div>
            <div style="font-size: 10px; color: #666; font-family: monospace;">ID: ${empIdValue}</div>
          </td>
          <td style="font-family: monospace; font-weight: bold; text-transform: uppercase; color: #444;">${store}</td>
          <td>
            <span class="badge ${esRetardo ? 'badge-retardo' : movement.toUpperCase().includes('SALIDA') ? 'badge-salida' : 'badge-entrada'}">
              ${movement} ${esRetardo ? '- RETARDO' : ''}
            </span>
          </td>
          <td style="font-family: monospace; color: #333;">${date}</td>
          <td style="font-family: monospace; font-weight: bold; color: #111;">
            ${time}
            ${isEdited ? `<div style="font-size: 8px; color: #e65100; font-family: sans-serif; font-weight: bold; margin-top: 2px;">MODIFICADO</div>` : ''}
          </td>
          <td style="font-size: 10px; max-width: 180px; word-wrap: break-words; color: #555; font-style: italic;">
            ${comment ? `"${comment}"` : '-'}
          </td>
        </tr>
      `;
    }).join('');

    const filtroFechaText = dateMode === 'SINGLE' ? `Día: ${singleDate}` : `Rango: ${startDate} al ${endDate}`;

    printWindow.document.write(plotPdfLayout(activeTab, filtroFechaText, allRecords.length, tableRowsHtml));
    printWindow.document.close();
  };

  const plotPdfLayout = (tab, periodo, total, rows) => `
    <html>
      <head>
        <title>Reporte_Asistencias_${tab}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm 10mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #222; margin: 0; padding: 0; font-size: 11px; line-height: 1.4; }
          .header { border-bottom: 3px solid #ea580c; padding-bottom: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-end; }
          .title { font-size: 18px; font-weight: bold; color: #111; text-transform: uppercase; letter-spacing: 0.5px; }
          .subtitle { font-size: 11px; color: #555; margin-top: 2px; }
          .meta-box { background-color: #f4f4f5; border: 1px solid #e4e4e7; padding: 8px 12px; border-radius: 6px; margin-bottom: 15px; display: flex; gap: 20px; }
          .meta-item { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #71717a; }
          .meta-item span { color: #111; font-family: monospace; font-size: 11px; display: block; margin-top: 1px; }
          table { width: 100%; border-collapse: collapse; text-align: left; margin-top: 5px; }
          th { background-color: #18181b; color: #ffffff; font-family: monospace; font-size: 9px; text-transform: uppercase; padding: 7px 8px; letter-spacing: 0.5px; }
          td { padding: 7px 8px; border-bottom: 1px solid #e4e4e7; vertical-align: top; }
          tr:nth-child(even) { background-color: #fafafa; }
          .badge { display: inline-block; padding: 2px 6px; font-size: 9px; font-weight: bold; border-radius: 4px; text-transform: uppercase; }
          .badge-entrada { background-color: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
          .badge-salida { background-color: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
          .badge-retardo { background-color: #fff7ed; color: #9a3412; border: 1px solid #ffedd5; }
          .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 8px; color: #a1a1aa; border-top: 1px solid #e4e4e7; padding-top: 4px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">REPORTE OFICIAL DE ASISTENCIAS</div>
            <div class="subtitle">Sistema Control de Accesos - Panel Administrativo</div>
          </div>
          <div style="text-align: right; font-size: 9px; color: #71717a; font-family: monospace;">
            Generado: ${new Date().toLocaleDateString('es-MX')} ${new Date().toLocaleTimeString('es-MX', {hour: '2-digit', minute:'2-digit'})}
          </div>
        </div>
        <div class="meta-box">
          <div class="meta-item">Vista Filtro: <span style="font-weight: bold; color: #ea580c;">${tab === 'GENERAL' ? 'TODAS LAS SUCURSALES' : tab}</span></div>
          <div class="meta-item">Período Seleccionado: <span>${periodo}</span></div>
          <div class="meta-item">Total Registros: <span>${total}</span></div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 25%;">Empleado</th>
              <th style="width: 15%;">Sucursal</th>
              <th style="width: 20%;">Movimiento</th>
              <th style="width: 12%;">Fecha</th>
              <th style="width: 12%;">Hora</th>
              <th style="width: 16%;">Justificación / Comentario</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="footer">Documento de control administrative interno. Copia digital autorizada por el Panel de Administración de Sistemas.</div>
        <script>
          window.onload = function() { window.print(); setTimeout(function(){ window.close(); }, 500); };
        </script>
      </body>
    </html>
  `;

  const handleExportWeeklyHoursToPDF = () => {
    if (filteredHoursReport.length === 0) {
      alert("No hay cálculos consolidados en esta vista para exportar.");
      return;
    }

    const printWindow = window.open('', '_blank');

    const tableRowsHtml = filteredHoursReport.map((emp) => {
      let badgeStyle = 'background-color: #f0fdf4; color: #166534; border: 1px solid #bbf7d0;';
      let statusText = `+${emp.horasExtra} hrs Extra`;

      if (emp.balanceEstatus === 'FALTANTE') {
        badgeStyle = 'background-color: #fef2f2; color: #991b1b; border: 1px solid #fecaca;';
        statusText = `-${emp.horasFaltantes} hrs Faltan`;
      } else if (emp.horasExtra === 0 && emp.horasFaltantes === 0) {
        badgeStyle = 'background-color: #fffbeb; color: #92400e; border: 1px solid #fef3c7;';
        statusText = 'Jornada Exacta';
      }

      return `
        <tr>
          <td style="font-family: monospace; font-weight: bold; color: #444; font-size: 11px;">${emp.id}</td>
          <td style="font-weight: bold; color: #111; font-size: 12px;">${emp.name}</td>
          <td style="font-family: monospace; text-align: center; color: #444;">${emp.horasEsperadas} hrs</td>
          <td style="font-family: monospace; text-align: center; font-weight: bold; color: #111;">${emp.horasReales} hrs</td>
          <td style="text-align: center;">
            <span class="badge" style="${badgeStyle}">
              ${statusText.toUpperCase()}
            </span>
          </td>
        </tr>
      `;
    }).join('');

    const periodoText = infoSemana.fechaInicio ? `Del ${formatDatePickerString(infoSemana.fechaInicio)} al ${formatDatePickerString(infoSemana.fechaFin)}` : 'Período no definido';
    const condicionText = {
      TODOS: 'TODOS LOS TRABAJADORES',
      SOLO_EXTRA: 'SOLO PERSONAL CON HORAS EXTRA',
      SOLO_FALTANTE: 'SOLO PERSONAL CON HORAS FALTANTES',
      EXACTO: 'SOLO JORNADAS EXACTAS'
    }[hoursConditionFilter];

    printWindow.document.write(`
      <html>
        <head>
          <title>Reporte_Semanal_Horas</title>
          <style>
            @page { size: A4 portrait; margin: 15mm 12mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #222; margin: 0; padding: 0; font-size: 11px; line-height: 1.5; }
            .header { border-bottom: 3px solid #ea580c; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end; }
            .title { font-size: 18px; font-weight: bold; color: #111; text-transform: uppercase; letter-spacing: 0.5px; }
            .meta-box { background-color: #f4f4f5; border: 1px solid #e4e4e7; padding: 10px 14px; border-radius: 6px; margin-bottom: 20px; display: flex; gap: 24px; }
            .meta-item { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #71717a; }
            .meta-item span { color: #111; font-family: monospace; font-size: 11px; display: block; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; text-align: left; margin-top: 5px; }
            th { background-color: #18181b; color: #ffffff; font-family: monospace; font-size: 9px; text-transform: uppercase; padding: 9px 10px; letter-spacing: 0.5px; }
            td { padding: 9px 10px; border-bottom: 1px solid #e4e4e7; vertical-align: middle; }
            tr:nth-child(even) { background-color: #fafafa; }
            .badge { display: inline-block; padding: 3px 8px; font-size: 9px; font-weight: bold; border-radius: 4px; letter-spacing: 0.3px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">REPORTE DE METRAJE Y BALANCES HORARIOS</div>
            </div>
            <div style="text-align: right; font-size: 9px; color: #71717a; font-family: monospace;">
              Impreso: ${new Date().toLocaleDateString('es-MX')}
            </div>
          </div>
          <div class="meta-box">
            <div class="meta-item">Rango de Corte: <span style="font-weight: bold; color: #ea580c;">${periodoText}</span></div>
            <div class="meta-item">Filtro Condición: <span>${condicionText}</span></div>
            <div class="meta-item">Empleados en Lista: <span>${filteredHoursReport.length}</span></div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 15%;">ID Sistema</th>
                <th style="width: 35%;">Nombre del Trabajador</th>
                <th style="width: 15%; text-align: center;">Horas Esperadas</th>
                <th style="width: 15%; text-align: center;">Horas Reales</th>
                <th style="width: 20%; text-align: center;">Diferencia Registrada</th>
              </tr>
            </thead>
            <tbody>${tableRowsHtml}</tbody>
          </table>
          </body>
      </html>
    `);
    printWindow.document.close();
  };

  // ============================================================
  // RENDER DEL MINI CALENDARIO
  // ============================================================
  const renderMiniCalendario = (emp) => {
    const dias = [
      { label: 'L', val: emp.rawLun, name: 'Lunes' },
      { label: 'M', val: emp.rawMar, name: 'Martes' },
      { label: 'M', val: emp.rawMie, name: 'Miércoles' },
      { label: 'J', val: emp.rawJue, name: 'Jueves' },
      { label: 'V', val: emp.rawVie, name: 'Viernes' },
      { label: 'S', val: emp.rawSab, name: 'Sábado' },
      { label: 'D', val: emp.rawDom, name: 'Domingo' }
    ];

    return (
      <div className="flex flex-wrap gap-1.5 py-1">
        {dias.map((d, i) => {
          const esDescanso = !d.val || d.val.toUpperCase().includes('DESCANSO') || d.val === '-';
          return (
            <div
              key={i}
              title={`${d.name}: ${esDescanso ? 'Descanso' : d.val}`}
              className={`flex flex-col items-center justify-center w-9 h-9 rounded text-[10px] font-mono border ${
                esDescanso 
                  ? 'bg-zinc-950/40 border-zinc-800/80 text-zinc-600' 
                  : 'bg-zinc-900 border-orange-500/20 text-orange-400 shadow-sm'
              }`}
            >
              <span className="text-[8px] font-sans font-bold text-zinc-500 block uppercase">{d.label}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // ============================================================
  // RENDER DE ACCIONES DEL EMPLEADO
  // ============================================================
  const renderEmployeeActions = (emp) => {
    const isOnVacation = emp.onVacation === true || (emp.vacations && emp.vacations.status === 'ACTIVO');

    return (
      <div className="flex flex-wrap justify-end gap-1.5">
        {isOnVacation && (
          <span className="text-[10px] bg-amber-950/40 border border-amber-900/60 px-3 py-1.5 rounded text-amber-400 font-mono uppercase tracking-wider font-bold">
            Vacaciones
          </span>
        )}

        <button
          onClick={() => openVacationModal(emp)}
          className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-blue-400 border border-zinc-700/60 rounded font-bold text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
        >
          Vacaciones
        </button>

        {!isOnVacation && (
          <button
            onClick={() => openScheduleModal(emp)}
            className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-orange-500 border border-zinc-700/60 rounded font-bold text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
          >
            Horario
          </button>
        )}
      </div>
    );
  };

  // ============================================================
  // COMPONENTE DE DIALOGO DE CONFIRMACION
  // ============================================================
  const ConfirmDialog = () => {
    if (!showConfirmDialog) return null;

    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 shadow-2xl max-w-md w-full p-6">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-lg font-bold text-white">Confirmar Accion</h3>
          </div>

          <p className="text-zinc-300 text-sm mb-6">
            {confirmMessage || '¿Estas seguro de realizar esta accion?'}
          </p>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setShowConfirmDialog(false);
                setConfirmEmployee(null);
                setConfirmAction(null);
              }}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-bold transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                if (confirmAction) {
                  confirmAction();
                }
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition-colors"
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // COMPONENTE MODAL DE EDICION DE HORARIO
  // ============================================================
  const ScheduleModal = React.memo(() => {
    if (!showScheduleModal || !editingEmployeeForSchedule) return null;

    const emp = editingEmployeeForSchedule;
    const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const colores = {
      Lunes: 'border-blue-500/30 bg-blue-950/10',
      Martes: 'border-indigo-500/30 bg-indigo-950/10',
      Miércoles: 'border-purple-500/30 bg-purple-950/10',
      Jueves: 'border-pink-500/30 bg-pink-950/10',
      Viernes: 'border-emerald-500/30 bg-emerald-950/10',
      Sábado: 'border-amber-500/30 bg-amber-950/10',
      Domingo: 'border-rose-500/30 bg-rose-950/10'
    };

    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
          <div className="p-6 border-b border-zinc-800 flex justify-between items-center flex-shrink-0">
            <div>
              <h3 className="text-lg font-bold text-white">Configuracion de Cronograma Semanal</h3>
              <p className="text-sm text-zinc-400">
                {emp.name} (ID: {emp.id}) - Sucursal: {emp.store}
              </p>
            </div>
            <button
              onClick={() => {
                setShowScheduleModal(false);
                setEditingEmployeeForSchedule(null);
              }}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded text-xs font-bold transition-colors"
            >
              Cerrar
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {diasSemana.map((dia) => {
                const diaKey = dia;
                const data = scheduleEditData[diaKey];
                const colorClass = colores[diaKey] || 'border-zinc-800 bg-zinc-800/10';

                return (
                  <div
                    key={diaKey}
                    className={`border ${colorClass} rounded-xl p-4 transition-all hover:border-opacity-100`}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-zinc-200 text-sm uppercase tracking-wide">{diaKey}</span>
                      <label className="flex items-center gap-1.5 text-[10px] text-zinc-400 cursor-pointer select-none bg-zinc-950 px-2.5 py-1 rounded-full border border-zinc-800 hover:border-zinc-600 transition-colors">
                        <input
                          type="checkbox"
                          checked={data.isLaborable}
                          onChange={(e) => handleScheduleDayChange(diaKey, 'isLaborable', e.target.checked)}
                          className="accent-orange-500 rounded w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className="font-medium">Labora</span>
                      </label>
                    </div>

                    {data.isLaborable ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <span className="text-[8px] font-bold text-zinc-500 block uppercase tracking-widest">Entrada</span>
                          <div className="relative">
                            <input
                              type="time"
                              value={data.in}
                              onChange={(e) => handleScheduleDayChange(diaKey, 'in', e.target.value)}
                              className="w-full bg-zinc-950 border-2 border-zinc-600 hover:border-orange-500 focus:border-orange-500 rounded-lg px-3 py-2.5 font-mono text-base text-orange-400 focus:outline-none transition-all shadow-inner cursor-pointer"
                              style={{
                                minHeight: '44px'
                              }}
                            />
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-end pr-3">
                              <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[8px] font-bold text-zinc-500 block uppercase tracking-widest">Salida</span>
                          <div className="relative">
                            <input
                              type="time"
                              value={data.out}
                              onChange={(e) => handleScheduleDayChange(diaKey, 'out', e.target.value)}
                              className="w-full bg-zinc-950 border-2 border-zinc-600 hover:border-amber-500 focus:border-amber-500 rounded-lg px-3 py-2.5 font-mono text-base text-amber-500 focus:outline-none transition-all shadow-inner cursor-pointer"
                              style={{
                                minHeight: '44px'
                              }}
                            />
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-end pr-3">
                              <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-3 text-center bg-zinc-950/50 rounded-lg border border-dashed border-zinc-700/50 text-zinc-500 font-bold text-xs uppercase tracking-widest">
                        Dia de Descanso
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex justify-end gap-3 flex-shrink-0">
            <button
              onClick={() => {
                setShowScheduleModal(false);
                setEditingEmployeeForSchedule(null);
              }}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-bold transition-colors uppercase tracking-wider"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveSchedule}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-bold transition-colors uppercase tracking-wider"
            >
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>
    );
  });

  // ============================================================
  // COMPONENTE MODAL DE GESTION DE VACACIONES
  // ============================================================
  const VacationModal = React.memo(() => {
    if (!showVacationModal || !selectedEmployeeForVacations) return null;

    const emp = selectedEmployeeForVacations;

    const getStatusBadge = (vacation) => {
      const status = vacation.estadoReal || vacation.status;

      if (status === 'BORRADO' || status === 'FINALIZADO') {
        return <span className="px-2 py-0.5 bg-zinc-800 text-zinc-500 rounded text-[10px] font-bold uppercase">Finalizada</span>;
      }
      if (status === 'PENDIENTE') {
        return <span className="px-2 py-0.5 bg-blue-950/40 text-blue-400 border border-blue-900/40 rounded text-[10px] font-bold uppercase">Pendiente</span>;
      }
      if (status === 'ACTIVA') {
        return <span className="px-2 py-0.5 bg-amber-950/40 text-amber-400 border border-amber-900/40 rounded text-[10px] font-bold uppercase">Activa</span>;
      }
      if (status === 'FINALIZADA') {
        return <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded text-[10px] font-bold uppercase">Finalizada</span>;
      }
      return <span className="px-2 py-0.5 bg-zinc-800 text-zinc-500 rounded text-[10px] font-bold uppercase">{status}</span>;
    };

    const hasActiveVacation = employeeVacations.some(v =>
      v.status === 'ACTIVO' &&
      (v.estadoReal === 'ACTIVA' || v.estadoReal === 'PENDIENTE')
    );

    return (
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowVacationModal(false);
            setSelectedEmployeeForVacations(null);
            setShowNewVacationForm(false);
            setEditingVacationId(null);
          }
        }}
      >
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
          <div className="p-6 border-b border-zinc-800 flex justify-between items-center flex-shrink-0">
            <div>
              <h3 className="text-lg font-bold text-white">Gestion de Vacaciones</h3>
              <p className="text-sm text-zinc-400">
                {emp.name} (ID: {emp.id}) - Sucursal: {emp.store}
              </p>
            </div>
            <button
              onClick={() => {
                setShowVacationModal(false);
                setSelectedEmployeeForVacations(null);
                setShowNewVacationForm(false);
                setEditingVacationId(null);
              }}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded text-xs font-bold transition-colors"
            >
              Cerrar
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1">
            {!showNewVacationForm && !hasActiveVacation && (
              <button
                onClick={() => {
                  setShowNewVacationForm(true);
                  setEditingVacationId(null);
                  setNewVacationStart('');
                  setNewVacationEnd('');
                }}
                className="w-full mb-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Agregar Nuevo Periodo Vacacional
              </button>
            )}

            {hasActiveVacation && !showNewVacationForm && (
              <div className="w-full mb-4 py-2.5 bg-amber-950/30 border border-amber-900/40 text-amber-400 rounded-lg text-xs font-bold uppercase tracking-wider text-center">
                El empleado ya tiene un periodo vacacional activo o pendiente
              </div>
            )}

            {showNewVacationForm && (
              <div className="bg-zinc-950 border border-orange-500/30 rounded-xl p-4 mb-4 space-y-3">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                  <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Nuevo Periodo Vacacional</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight block mb-1">
                      Fecha Inicio
                    </label>
                    <input
                      type="date"
                      value={newVacationStart}
                      onChange={(e) => setNewVacationStart(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight block mb-1">
                      Fecha Fin
                    </label>
                    <input
                      type="date"
                      value={newVacationEnd}
                      onChange={(e) => setNewVacationEnd(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setShowNewVacationForm(false)}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded text-[10px] font-bold uppercase transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveNewVacationFromModal}
                    className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded text-[10px] font-bold uppercase transition-colors"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            )}

            {loadingVacations ? (
              <div className="text-center py-8 text-zinc-500 text-sm animate-pulse">Cargando vacaciones...</div>
            ) : employeeVacations.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-sm">No hay registros de vacaciones para este empleado.</div>
            ) : (
              <div className="space-y-3">
                {employeeVacations.map((vac) => {
                  const isEditing = editingVacationId === vac.id;
                  const isActive = vac.status === 'ACTIVO' && (vac.estadoReal === 'ACTIVA' || vac.estadoReal === 'PENDIENTE');

                  return (
                    <div key={vac.id} className={`border rounded-xl p-4 ${
                      vac.estadoReal === 'ACTIVA' ? 'border-amber-500/30 bg-amber-950/5' :
                      vac.estadoReal === 'PENDIENTE' ? 'border-blue-500/20 bg-blue-950/5' :
                      vac.estadoReal === 'FINALIZADA' ? 'border-zinc-700/50 bg-zinc-800/10' :
                      'border-zinc-800/50 bg-zinc-800/5'
                    }`}>
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight block mb-1">
                                Fecha Inicio
                              </label>
                              <input
                                type="date"
                                value={vacationEditData.startDate}
                                onChange={(e) => setVacationEditData(prev => ({ ...prev, startDate: e.target.value }))}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight block mb-1">
                                Fecha Fin
                              </label>
                              <input
                                type="date"
                                value={vacationEditData.endDate}
                                onChange={(e) => setVacationEditData(prev => ({ ...prev, endDate: e.target.value }))}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={cancelEditVacation}
                              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded text-[10px] font-bold uppercase transition-colors"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={handleSaveEditVacation}
                              className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded text-[10px] font-bold uppercase transition-colors"
                            >
                              Guardar Cambios
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              {getStatusBadge(vac)}
                              <span className="text-xs font-mono text-zinc-500">{vac.id}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-sm">
                              <span className="text-zinc-300">
                                <span className="text-zinc-500">Desde:</span> {formatDateForDisplay(vac.startDate)}
                              </span>
                              <span className="text-zinc-300">
                                <span className="text-zinc-500">Hasta:</span> {formatDateForDisplay(vac.endDate)}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            {isActive && (
                              <>
                                <button
                                  onClick={() => startEditVacation(vac)}
                                  className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-blue-400 rounded text-[10px] font-bold uppercase transition-colors"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => handleDeleteVacationFromModal(vac)}
                                  className="px-2 py-1 bg-zinc-800 hover:bg-red-950/50 text-red-400 rounded text-[10px] font-bold uppercase transition-colors"
                                >
                                  Eliminar
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex-shrink-0">
            <div className="flex items-center justify-between text-[10px] text-zinc-500">
              <span>Total: {employeeVacations.length} registros</span>
              <div className="flex gap-3">
                <span><span className="text-amber-400">●</span> Activa</span>
                <span><span className="text-blue-400">●</span> Pendiente</span>
                <span><span className="text-zinc-500">●</span> Finalizada</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  });

  // ============================================================
  // COMPONENTE MODAL DE VALIDACIÓN DE ADMIN
  // ============================================================
  const AdminPinDialog = () => {
    if (!showAdminPinDialog) return null;

    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
        <div 
          className="bg-zinc-900 rounded-xl border border-zinc-800 shadow-2xl max-w-sm w-full p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4">
            <h3 className="text-lg font-bold text-white">Verificar Identidad</h3>
            <p className="text-sm text-zinc-400 mt-1">
              Ingresa tu contraseña de administrador para ver la contraseña de {pendingEmployeeForPin?.name}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Contraseña de Administrador</label>
              <input
                type="password"
                value={adminPinInput}
                onChange={(e) => setAdminPinInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    validateAdminPin();
                  }
                }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-orange-500 transition-all"
                placeholder="Ingresa tu contraseña"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={closeAdminPinDialog}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-bold transition-colors uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button
                onClick={validateAdminPin}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-bold transition-colors uppercase tracking-wider"
              >
                Verificar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // FILTRO DE HORAS REPORTE
  // ============================================================
  const filteredHoursReport = useMemo(() => {
    return reporteHoras.filter(emp => {
      const q = hoursSearchQuery.toLowerCase().trim();
      const matchesQuery = q ? (emp.name.toLowerCase().includes(q) || emp.id.toLowerCase().includes(q)) : true;

      if (!matchesQuery) return false;

      if (hoursConditionFilter === 'SOLO_EXTRA') {
        return emp.balanceEstatus === 'EXTRA' && emp.horasExtra > 0;
      }
      if (hoursConditionFilter === 'SOLO_FALTANTE') {
        return emp.balanceEstatus === 'FALTANTE' && emp.horasFaltantes > 0;
      }
      if (hoursConditionFilter === 'EXACTO') {
        return emp.horasExtra === 0 && emp.horasFaltantes === 0;
      }
      return true;
    });
  }, [reporteHoras, hoursSearchQuery, hoursConditionFilter]);

  // ============================================================
  // RENDER PRINCIPAL
  // ============================================================
  const personalLaborandoHoy = obtenerPersonalLaborandoHoy();

  const empleadosPorSucursal = (sucursal) => {
    if (sucursal === 'GENERAL') {
      return nonAdminEmployees.length;
    }
    return nonAdminEmployees.filter(e => e.store?.toUpperCase() === sucursal).length;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* HEADER */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-xl gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Panel de Administracion General
            </h1>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <button
              onClick={() => fetchAdminData(currentPage, true, true)}
              disabled={isRefreshing}
              className={`px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isRefreshing ? 'Sincronizando...' : 'Sincronizar'}
            </button>
            <button onClick={onLogout} className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-bold transition-all uppercase tracking-wider">
              Salir
            </button>
          </div>
        </header>

        {/* NAVEGACIÓN PRINCIPAL */}
        <nav className="flex flex-wrap gap-2 p-1 bg-zinc-900 rounded-lg border border-zinc-800">
          {['GENERAL', 'PENIEL', 'EMAR', 'EBEN-EZER', 'PERSONAL', 'HORAS'].map((tab) => (
            <button
              key={tab}
              onClick={() => { 
                setActiveTab(tab); 
                setStatusMessage({ text: '', isError: false });
                // Forzar carga de horas si es la pestaña de HORAS
                if (tab === 'HORAS') {
                  setLoadingHoras(true);
                }
              }}
              className={`flex-1 min-w-[110px] text-center py-2.5 rounded-md text-xs font-bold uppercase transition-all ${activeTab === tab ? 'bg-orange-600 text-white shadow-md' : 'text-zinc-400 hover:bg-zinc-800'}`}
            >
              {tab === 'GENERAL' ? 'Todas las Tiendas' :
                tab === 'PERSONAL' ? 'Gestion de Personal' :
                  tab === 'HORAS' ? 'Control de Horas' : `Sucursal ${tab}`}
            </button>
          ))}
        </nav>

        {/* FEEDBACK - Solo se muestra cuando hay mensaje */}
        {statusMessage.text && (
          <div className={`p-4 rounded-lg text-xs font-bold uppercase tracking-wide border ${statusMessage.isError ? 'bg-zinc-950 border-red-900 text-red-400' : 'bg-zinc-950 border-emerald-800 text-emerald-400'}`}>
            {statusMessage.text}
          </div>
        )}

        {/* ========================================================== */}
        {/* PESTAÑA: GESTIÓN DE PERSONAL */}
        {/* ========================================================== */}
        {activeTab === 'PERSONAL' ? (
          <main className="bg-zinc-900 rounded-xl border border-zinc-800 shadow-xl overflow-hidden">
            <div className="p-6 border-b border-zinc-800 bg-zinc-900 flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Catalogo y Control de Personal Activo</h2>
              </div>
              <button
                onClick={openAddEmployeeModal}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-bold transition-colors uppercase tracking-wider"
              >
                + Agregar Empleado
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 uppercase font-mono text-[10px] tracking-wider">
                    <th className="py-3 px-4" style={{ width: '16%' }}>Trabajador</th>
                    <th className="py-3 px-4" style={{ width: '8%' }}>ID</th>
                    <th className="py-3 px-4" style={{ width: '10%' }}>Sucursal</th>
                    <th className="py-3 px-4" style={{ width: '8%' }}>Rol</th>
                    <th className="py-3 px-4" style={{ width: '28%' }}>Calendario / Estado Vacacional</th>
                    <th className="py-3 px-4" style={{ width: '10%' }}>Ultimo Ajuste</th>
                    <th className="py-3 px-4 text-right" style={{ width: '20%' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-xs font-medium">
                  {employeesList.map((emp) => {
                    const isOnVacation = emp.onVacation === true || (emp.vacations && emp.vacations.status === 'ACTIVO');

                    return (
                      <tr
                        key={emp.id}
                        className={`transition-all ${isOnVacation ? 'bg-zinc-950/40 text-zinc-400 border-amber-500/10 hover:bg-zinc-950/60' : 'hover:bg-zinc-800/30'}`}
                      >
                        <td className="py-4 px-4">
                          <div className="font-bold text-white text-sm">{emp.name}</div>
                          {isOnVacation && emp.vacations && (
                            <div className="mt-1 text-[10px] text-amber-400 font-mono">
                              {emp.vacations.start || 'Fecha no disponible'} al {emp.vacations.end || 'Fecha no disponible'}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4 font-mono text-zinc-500 uppercase">{emp.id}</td>
                        <td className="py-4 px-4">
                          <span className="px-2 py-0.5 bg-zinc-950 border border-zinc-800 rounded text-[10px] font-bold font-mono text-zinc-400 uppercase">
                            {emp.store}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${emp.role === 'ADMIN' ? 'bg-amber-950/40 text-amber-400 border border-amber-900/40' : 'bg-zinc-800 text-zinc-400'}`}>
                            {emp.role || 'USER'}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          {renderMiniCalendario(emp)}
                        </td>
                        <td className="py-4 px-4 font-mono text-zinc-400 text-[11px]">
                          {emp.lastModified ? (
                            <span className="text-orange-500/90 font-mono font-semibold">
                              {formatShortModifiedDate(emp.lastModified)}
                            </span>
                          ) : (
                            <span className="text-zinc-600 italic">Estable</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right font-sans">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {renderEmployeeActions(emp)}
                            
                            <button
                              onClick={() => openEditEmployeeModal(emp)}
                              className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-blue-400 border border-zinc-700/60 rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                              title="Editar empleado"
                            >
                              Editar
                            </button>
                            
                            {emp.id !== 'EMP001' && (
                              <button
                                onClick={() => handleDeleteEmployee(emp)}
                                className="px-2 py-1 bg-zinc-800 hover:bg-red-950/50 text-red-400 border border-zinc-700/60 rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                                title="Eliminar empleado"
                              >
                                Eliminar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </main>
        ) : activeTab === 'HORAS' ? (
          // ==========================================================
          // PESTAÑA: CONTROL DE HORAS
          // ==========================================================
          <main className="space-y-6">
            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-xl space-y-4">
              <div className="border-b border-zinc-800 pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">Balances de Tiempo Laboral Semanal</h2>
                </div>
                {!loadingHoras && filteredHoursReport.length > 0 && (
                  <button
                    onClick={handleExportWeeklyHoursToPDF}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-orange-400 hover:text-orange-300 border border-orange-900/60 rounded-lg text-xs font-bold transition-all uppercase tracking-wider shadow-inner"
                  >
                    Exportar Vista (PDF)
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-zinc-950 p-4 rounded-lg border border-zinc-800/60">
                <div className="flex flex-col gap-1">
                  <label htmlFor="semana-select" className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                    1. Rango Semanal
                  </label>
                  <select
                    id="semana-select"
                    value={semanaSeleccionada}
                    onChange={(e) => setSemanaSeleccionada(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-orange-500 w-full"
                  >
                    <option value="EN_VIVO">Semana Actual</option>
                    {listaSemanasHistoricas.map((semId) => {
                      const partes = semId.split('_');
                      const inicio = partes[1] ? formatDatePickerString(partes[1]) : '';
                      const fin = partes[3] ? formatDatePickerString(partes[3]) : '';
                      return (
                        <option key={semId} value={semId}>
                          Historial: {inicio} al {fin}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="hours-search" className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                    2. Filtrar por Trabajador
                  </label>
                  <input
                    id="hours-search"
                    type="text"
                    placeholder="Nombre o ID..."
                    value={hoursSearchQuery}
                    onChange={(e) => setHoursSearchQuery(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 font-mono w-full"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="hours-condition" className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                    3. Metrica de Balance
                  </label>
                  <select
                    id="hours-condition"
                    value={hoursConditionFilter}
                    onChange={(e) => setHoursConditionFilter(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-orange-500 w-full"
                  >
                    <option value="TODOS">Ver todos los estados</option>
                    <option value="SOLO_EXTRA">Solo Horas Extras</option>
                    <option value="SOLO_FALTANTE">Solo Horas Faltantes</option>
                    <option value="EXACTO">Jornada Exactas</option>
                  </select>
                </div>
              </div>

              {infoSemana.fechaInicio && (
                <div className="flex justify-end">
                  <div className={`px-3 py-1.5 rounded-full text-[10px] font-bold font-mono tracking-wider border uppercase ${infoSemana.estatusCorte === 'ACTIVA' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-900 text-zinc-400 border-zinc-800'}`}>
                    {infoSemana.estatusCorte === 'ACTIVA'
                      ? `En curso (Del ${formatDatePickerString(infoSemana.fechaInicio)} al ${formatDatePickerString(infoSemana.fechaFin)})`
                      : `Congelada (Del ${formatDatePickerString(infoSemana.fechaInicio)} al ${formatDatePickerString(infoSemana.fechaFin)})`
                    }
                  </div>
                </div>
              )}
            </div>

            <div className="bg-zinc-900 rounded-xl border border-zinc-800 shadow-xl overflow-hidden">
              {loadingHoras ? (
                <div className="text-center py-12 text-zinc-500 font-medium text-sm animate-pulse">
                  Calculando registros matematicos y cargando balance...
                </div>
              ) : filteredHoursReport.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 font-medium text-sm">
                  No se encontraron marcas consolidadas que coincidan con los criterios de busqueda.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 uppercase font-mono text-[10px] tracking-wider">
                        <th className="py-3 px-4">ID</th>
                        <th className="py-3 px-4">Trabajador</th>
                        <th className="py-3 px-4 text-center">Horas Esperadas</th>
                        <th className="py-3 px-4 text-center">Horas Reales</th>
                        <th className="py-3 px-4 text-center">Diferencia / Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 text-xs font-medium">
                      {filteredHoursReport.map((emp) => {
                        let colorBadge = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                        let mensajeBalance = `+${emp.horasExtra} hrs Extra`;

                        if (emp.balanceEstatus === 'FALTANTE') {
                          colorBadge = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
                          mensajeBalance = `-${emp.horasFaltantes} hrs Faltan`;
                        } else if (emp.horasExtra === 0 && emp.horasFaltantes === 0) {
                          colorBadge = 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
                          mensajeBalance = 'Jornada Exacta';
                        }

                        return (
                          <tr key={emp.id} className="hover:bg-zinc-800/30 transition-all">
                            <td className="py-3.5 px-4 font-mono text-zinc-500 uppercase">{emp.id}</td>
                            <td className="py-3.5 px-4 font-bold text-white">{emp.name}</td>
                            <td className="py-3.5 px-4 text-center text-zinc-400 font-mono">{emp.horasEsperadas} hrs</td>
                            <td className="py-3.5 px-4 text-center text-zinc-200 font-semibold font-mono">{emp.horasReales} hrs</td>
                            <td className="py-3.5 px-4 text-center">
                              <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${colorBadge}`}>
                                {mensajeBalance}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </main>
        ) : (
          // ==========================================================
          // PESTAÑA: GENERAL, PENIEL, EMAR, EBEN-EZER
          // ==========================================================
          <>
            {/* MÉTRICAS */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800">
                <p className="text-xs font-bold tracking-wider text-zinc-500 uppercase">Registros en Vista</p>
                <h3 className="text-3xl font-black text-white mt-1">{allRecords.length}</h3>
                <p className="text-[10px] text-zinc-500 font-mono mt-1 uppercase">
                  Total: {totalRecords} registros
                </p>
              </div>

              <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800">
                <p className="text-xs font-bold tracking-wider text-zinc-500 uppercase">Personal Laborando Hoy</p>
                <h3 className="text-3xl font-black text-emerald-500 mt-1">{personalLaborandoHoy}</h3>
                <p className="text-[10px] text-zinc-500 font-mono mt-1 uppercase">
                  {activeTab === 'GENERAL' ? `${empleadosPorSucursal('GENERAL')} en total` : `${empleadosPorSucursal(activeTab)} en sucursal`}
                </p>
              </div>

              <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800">
                <p className="text-xs font-bold tracking-wider text-zinc-500 uppercase">Sucursal Seleccionada</p>
                <h3 className="text-2xl font-bold text-zinc-300 mt-1 uppercase">{activeTab}</h3>
              </div>
            </section>

            {/* FILTROS + QR */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-xl space-y-4">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-zinc-800 pb-2">Filtros de Busqueda</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold tracking-wider text-zinc-400 mb-1 uppercase">Buscar Trabajador</label>
                    <input 
                      type="text" 
                      placeholder="Nombre o ID..." 
                      value={searchQuery} 
                      onChange={(e) => setSearchQuery(e.target.value)} 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 font-mono" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold tracking-wider text-zinc-400 mb-1 uppercase">Tipo de Movimiento</label>
                    <select 
                      value={movementFilter} 
                      onChange={(e) => setMovementFilter(e.target.value)} 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-orange-500"
                    >
                      <option value="TODOS">Ver todos los movimientos</option>
                      <option value="ENTRADA">Entrada</option>
                      <option value="SALIDATEMPORAL">Salida Temporal</option>
                      <option value="ENTRADATEMPORAL">Entrada Temporal</option>
                      <option value="SALIDA">Salida</option>
                    </select>
                  </div>
                </div>

                <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800/60 space-y-3">
                  <div className="flex items-center gap-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    <span>Modo Calendario:</span>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="radio" checked={dateMode === 'SINGLE'} onChange={() => setDateMode('SINGLE')} className="accent-orange-500" /> Un Dia
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="radio" checked={dateMode === 'RANGE'} onChange={() => setDateMode('RANGE')} className="accent-orange-500" /> Rango Avanzado
                    </label>
                  </div>

                  {dateMode === 'SINGLE' ? (
                    <input 
                      type="date" 
                      value={singleDate} 
                      onChange={(e) => setSingleDate(e.target.value)} 
                      className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none font-mono" 
                    />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <input 
                        type="date" 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)} 
                        className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none font-mono" 
                      />
                      <input 
                        type="date" 
                        value={endDate} 
                        onChange={(e) => setEndDate(e.target.value)} 
                        className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none font-mono" 
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* QR */}
              <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-xl flex flex-col justify-between">
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-zinc-800 pb-2">Generador QR</h2>
                  <select 
                    value={qrStoreTarget} 
                    onChange={(e) => setQrStoreTarget(e.target.value)} 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm font-bold text-white focus:border-orange-500"
                  >
                    <option value="PENIEL">Sucursal PENIEL</option>
                    <option value="EMAR">Sucursal EMAR</option>
                    <option value="EBEN-EZER">Sucursal EBEN-EZER</option>
                  </select>

                  <div id="qr-print-zone" className="bg-white p-4 rounded-lg flex flex-col items-center justify-center border border-zinc-200 min-h-[220px]">
                    {generatedJson ? (
                      <QRCodeCanvas 
                        value={String(generatedJson)} 
                        size={160} 
                        style={{ width: "160px", height: "160px" }} 
                        level={"H"} 
                        includeMargin={true} 
                      />
                    ) : (
                      <div className="w-40 h-40 bg-zinc-100 animate-pulse rounded" />
                    )}
                    <p className="text-[10px] font-bold text-zinc-900 mt-2 font-mono uppercase bg-zinc-200 px-3 py-1 rounded">TIENDA: {qrStoreTarget}</p>
                  </div>
                </div>
                <button 
                  onClick={handlePrintQR} 
                  className="w-full mt-4 bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-lg text-xs uppercase tracking-wider"
                >
                  Imprimir QR
                </button>
              </div>
            </div>

            {/* TABLA PRINCIPAL DE REGISTROS */}
            <main className="bg-zinc-900 rounded-xl border border-zinc-800 shadow-xl overflow-hidden">
              <div className="p-6 border-b border-zinc-800 bg-zinc-900 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">Bitacora de Registros de Asistencia</h2>
                </div>

                {!loading && allRecords.length > 0 && (
                  <button
                    onClick={handleExportToPDF}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-orange-400 hover:text-orange-300 border border-orange-900/60 rounded-lg text-xs font-bold transition-all uppercase tracking-wider shadow-inner"
                  >
                    Exportar Vista (PDF)
                  </button>
                )}
              </div>

              {loading ? (
                <div className="text-center py-12 text-zinc-500 font-medium text-sm animate-pulse">Consultando base de datos...</div>
              ) : allRecords.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 font-medium text-sm">No se encontraron registros de asistencia.</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 uppercase font-mono text-[10px] tracking-wider">
                          <th className="py-3 px-4">Empleado</th>
                          <th className="py-3 px-4">ID Empleado</th>
                          <th className="py-3 px-4">Sucursal</th>
                          <th className="py-3 px-4">Movimiento</th>
                          <th className="py-3 px-4">Fecha</th>
                          <th className="py-3 px-4">Hora</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 text-xs font-medium">
                        {currentRecordsToDisplay.map((rec, idx) => {
                          const recordId = getValueByStrategy(rec, ["ID Registro", "ID_Registro", "id"], 0, '');
                          const empIdValue = getValueByStrategy(rec, ["ID Empleado", "ID_Empleado", "Empleado ID"], 1, 'N/A');
                          const dateValue = getValueByStrategy(rec, ["Fecha", "fecha"], 2, '--/--/----');
                          const timeValue = getValueByStrategy(rec, ["Hora", "hora"], 3, '--:--');
                          const movRaw = getValueByStrategy(rec, ["Movimiento", "movimiento"], 4, 'ENTRADA');
                          const storeValue = getValueByStrategy(rec, ["Sucursal"], 5, 'PENIEL');

                          const targetEmpObj = employeesList.find(e => String(e.id).toUpperCase() === String(empIdValue).toUpperCase());
                          const empNameValue = targetEmpObj ? targetEmpObj.name : 'Personal Activo';

                          const modPropValue = getValueByStrategy(rec, ["Modificacion", "Modificación"], 6, 'FALSE');
                          const isEdited = modPropValue.toUpperCase() === 'TRUE';

                          const currentComment = getValueByStrategy(rec, ["Justificacion", "justificacion", "Justificación"], 8, '');
                          const esRetardo = movRaw.toUpperCase().includes('ENTRADA') && !movRaw.toUpperCase().includes('TEMPORAL') && checkIsLate(timeValue, empIdValue, dateValue);

                          return (
                            <tr key={recordId || idx} className="hover:bg-zinc-800/30 transition-all group">
                              <td className="py-3.5 px-4 font-bold text-white">{empNameValue}</td>
                              <td className="py-3.5 px-4 font-mono text-zinc-500 uppercase">{empIdValue}</td>
                              <td className="py-3.5 px-4">
                                <span className="px-2 py-0.5 bg-zinc-950 border border-zinc-800 rounded text-[10px] font-bold font-mono text-zinc-400 uppercase">
                                  {storeValue}
                                </span>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                                  esRetardo ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                                  movRaw.toUpperCase().includes('TEMPORAL') ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                                  movRaw.toUpperCase().includes('SALIDA') ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                  'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                }`}>
                                  {movRaw} {esRetardo && '- RETARDO'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-zinc-300">{dateValue}</td>

                              <td className="py-3.5 px-4 font-mono text-zinc-300">
                                <div className="flex flex-col items-start gap-1 relative">
                                  {editingRecordId === recordId ? (
                                    <div className="flex flex-col gap-1.5 bg-zinc-950 p-2 rounded border border-orange-500/50 max-w-[200px] z-10 shadow-xl">
                                      <input
                                        type="text" 
                                        value={editingTimeValue} 
                                        onChange={(e) => setEditingTimeValue(e.target.value)}
                                        className="bg-zinc-900 border border-zinc-700 text-white rounded px-2 py-0.5 text-xs font-mono w-24 focus:outline-none"
                                      />
                                      <input
                                        type="text" 
                                        placeholder="Justificacion..." 
                                        value={editingCommentValue} 
                                        onChange={(e) => setEditingCommentValue(e.target.value)}
                                        className="bg-zinc-900 border border-zinc-700 text-zinc-300 rounded px-2 py-1 text-[11px] focus:outline-none w-full"
                                      />
                                      <div className="flex gap-1">
                                        <button 
                                          onClick={() => handleSaveTimeEdit(recordId)} 
                                          className="bg-orange-600 text-white font-bold px-2 py-0.5 rounded text-[10px] uppercase"
                                        >
                                          OK
                                        </button>
                                        <button 
                                          onClick={() => setEditingRecordId(null)} 
                                          className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded text-[10px]"
                                        >
                                          X
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <span className={`font-bold ${esRetardo ? 'text-amber-500 font-extrabold' : ''}`}>
                                        {timeValue}
                                      </span>
                                      <button
                                        onClick={() => {
                                          setEditingRecordId(recordId);
                                          setEditingTimeValue(timeValue);
                                          setEditingCommentValue(currentComment);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 text-[10px] text-orange-500 hover:underline transition-opacity font-sans cursor-pointer"
                                      >
                                        Editar
                                      </button>
                                    </div>
                                  )}

                                  {isEdited && (
                                    <div className="flex flex-col items-start mt-1 gap-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-sans font-bold text-orange-500 uppercase tracking-tight">
                                          Modificado por Admin
                                        </span>

                                        {currentComment && (
                                          <button
                                            onClick={() => toggleComment(recordId)}
                                            className={`text-[9px] font-sans px-1.5 py-0.5 rounded border transition-all font-semibold cursor-pointer ${
                                              expandedComments[recordId] ? 
                                              'bg-zinc-800 text-zinc-300 border-zinc-700' : 
                                              'bg-orange-950/40 text-orange-400 border-orange-900/40 hover:bg-orange-900/30'
                                            }`}
                                          >
                                            {expandedComments[recordId] ? ' Ocultar' : ' Ver Motivo'}
                                          </button>
                                        )}
                                      </div>

                                      {currentComment && expandedComments[recordId] && (
                                        <div className="text-[11px] font-sans text-zinc-300 bg-zinc-950 border border-orange-500/30 rounded px-2.5 py-1.5 max-w-[220px] break-words shadow-2xl mt-1 z-10">
                                          <span className="text-[10px] font-bold text-orange-400 block mb-0.5 uppercase tracking-wide">Justificacion:</span>
                                          <span className="italic">"{currentComment}"</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Barra de Controles de Paginacion */}
                  <div className="p-4 bg-zinc-900 border-t border-zinc-800/80 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-mono text-zinc-400">
                    <div>
                      Mostrando registros <span className="text-white font-bold">
                        {allRecords.length > 0 ? (currentPage - 1) * recordsPerPage + 1 : 0}
                      </span> al{' '}
                      <span className="text-white font-bold">
                        {Math.min(currentPage * recordsPerPage, totalRecords)}
                      </span>{' '}
                      de un total de <span className="text-orange-500 font-bold">{totalRecords}</span> resultados.
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className={`px-3 py-1.5 rounded-lg border font-bold uppercase tracking-wider text-[11px] transition-colors ${
                          currentPage === 1 ? 
                          'border-zinc-800 text-zinc-600 cursor-not-allowed bg-zinc-950/20' : 
                          'border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 cursor-pointer'
                        }`}
                      >
                        Anterior
                      </button>

                      <div className="px-3 py-1.5 bg-zinc-950 rounded-md border border-zinc-800 text-zinc-300">
                        Pagina <span className="text-orange-400 font-bold">{currentPage}</span> de <span className="text-zinc-500">{totalPages}</span>
                      </div>

                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className={`px-3 py-1.5 rounded-lg border font-bold uppercase tracking-wider text-[11px] transition-colors ${
                          currentPage === totalPages ? 
                          'border-zinc-800 text-zinc-600 cursor-not-allowed bg-zinc-950/20' : 
                          'border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 cursor-pointer'
                        }`}
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                </>
              )}
            </main>
          </>
        )}

      </div>

      {/* MODALES */}
      <ConfirmDialog />
      <ScheduleModal />
      <VacationModal />
      
      {/* MODAL DE EMPLEADOS - Componente separado optimizado */}
      <EmployeeModal
        isOpen={showEmployeeModal}
        isAdding={isAddingEmployee}
        employee={editingEmployee}
        onClose={() => setShowEmployeeModal(false)}
        onSave={() => fetchAdminData(currentPage, true, false)}
        onShowPin={handleShowPin}
        showPinForEmployee={showPinForEmployee}
        user={user}
        apiUrl={apiUrl}
        setStatusMessage={setStatusMessage}
      />
      
      <AdminPinDialog />
    </div>
  );
}

export default AdminPanel;