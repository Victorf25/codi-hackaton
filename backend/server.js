const express = require('express');
const axios = require('axios'); // Para hacer peticiones a la API de Pey
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors()); // Permite que tu frontend se comunique con este backend

// Variable temporal en memoria para simular la base de datos durante el hackatón
let estadoDonativo = {
    id: null,
    status: 'PENDIENTE'
};

// CONSTANTES DE PEY (Reemplaza con los datos que te dé el hackatón)
const PEY_API_URL = 'https://pey.mx'; // URL ficticia de ejemplo, revisa docs.pey.mx
const PEY_TOKEN = 'TU_TOKEN_DE_PRUEBAS_AQUÍ'; 

// ==========================================
// 1. RUTA PARA GENERAR EL QR DE CODI
// ==========================================
app.post('/api/generar-donativo', async (req, res) => {
    const { monto } = req.body; // Recibe $20, $50 o $100 desde el frontend

    try {
        // Estructura típica que pide una API de cobro QR (revisar documentación de Pey)
        const dataPey = {
            amount: monto,
            currency: 'MXN',
            concept: 'Donativo causa social',
            // Tu URL de Ngrok + la ruta del webhook para que Pey te avise aquí
            webhook_url: 'https://TU_SUBDOMINIO_NGROK.ngrok-free.app/api/webhook-pey' 
        };

        const response = await axios.post(PEY_API_URL, dataPey, {
            headers: {
                'Authorization': `Bearer ${PEY_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        // Guardamos el ID del cobro que nos dio Pey para rastrearlo
        estadoDonativo.id = response.data.id;
        estadoDonativo.status = 'PENDIENTE';

        // Le regresamos al frontend el texto del QR o la imagen que mande Pey
        return res.status(200).json({
            success: true,
            qr_code: response.data.qr_code, // El string para generar el QR en frontend
            charge_id: response.data.id
        });

    } catch (error) {
        console.error('Error al conectar con Pey:', error.response?.data || error.message);
        return res.status(500).json({ success: false, message: 'No se pudo generar el QR' });
    }
});

// ==========================================
// 2. EL WEBHOOK: AQUÍ TE AVISA PEY CUANDO YA PAGARON
// ==========================================
app.post('/api/webhook-pey', (req, res) => {
    const eventoPey = req.body;

    console.log('¡Webhook recibido de Pey!', eventoPey);

    // Verificamos si el pago fue exitoso según la estructura de su API
    if (eventoPey.status === 'PAID' || eventoPey.event === 'charge.success') {
        
        // Si el ID coincide con el donativo que estamos esperando...
        if (eventoPey.id === estadoDonativo.id) {
            estadoDonativo.status = 'COMPLETADO';
            console.log('💰 ¡El donativo ha sido pagado y validado con éxito!');
        }
    }

    // Regresar un estado 200 SIEMPRE a Pey para que sepa que recibiste el aviso
    return res.status(200).send('OK');
});

// ==========================================
// 3. RUTA AUXILIAR: EL FRONTEND PREGUNTA SI YA PAGARON
// ==========================================
// Como es un hackatón y no usaremos WebSockets (para no complicarnos), el frontend 
// le preguntará a esta ruta cada 3 segundos si el estado ya cambió a 'COMPLETADO'.
app.get('/api/status-donativo', (req, res) => {
    return res.json({ status: estadoDonativo.status });
});

// Levantar el servidor en el puerto 3000
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor del Hackatón corriendo en http://localhost:${PORT}`);
});
