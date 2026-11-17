const mysql = require('mysql2/promise');
module.exports = mysql.createPool({
  host: 'localhost', user: 'root', password: 'TU_CONTRASEÑA',
  database: 'restogest', waitForConnections: true, connectionLimit: 10
});
