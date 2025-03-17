import { exec } from 'node:child_process';

const port = 3050; // Cambia el puerto si es necesario

// Verificar si el puerto está en uso
exec(`netstat -ano | findstr :${port}`, (err, stdout, stderr) => {
  if (err || stderr) {
    console.log(`El puerto ${port} está libre o no puede ser verificado.`);
    return;
  }

  // Si el puerto está en uso, matar el proceso
  const pid = stdout.split('\n')[0]?.trim().split(/\s+/).pop(); // Obtener PID del proceso
  if (pid) {
    console.log(`El puerto ${port} está ocupado por el proceso PID ${pid}. Matando el proceso...`);
    exec(`taskkill /PID ${pid} /F`, (killErr) => {
      if (killErr) {
        console.error(`Error al matar el proceso: ${killErr.message}`);
        return;
      }
      console.log(`Proceso con PID ${pid} terminado exitosamente.`);
    });
  }
});