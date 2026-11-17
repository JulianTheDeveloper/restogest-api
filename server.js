const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const err = (res, e) => {
  console.error(e);
  res.status(500).json({ error: e.message });
};

const precioInvalido = (precio) => precio == null || precio === '' || Number.isNaN(Number(precio)) || Number(precio) <= 0;

app.get('/api/productos', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM productos ORDER BY id_producto');
    res.json(rows);
  } catch (e) { err(res, e); }
});
app.get('/api/productos/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM productos WHERE id_producto = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(rows[0]);
  } catch (e) { err(res, e); }
});
app.post('/api/productos', async (req, res) => {
  try {
    const { id_categoria, nombre, descripcion, precio } = req.body;
    if (precioInvalido(precio)) return res.status(400).json({ error: 'El precio debe ser mayor que 0' });
    const [r] = await db.query(
      'INSERT INTO productos (id_categoria, nombre, descripcion, precio) VALUES (?,?,?,?)',
      [id_categoria, nombre, descripcion ?? null, precio]
    );
    res.status(201).json({ mensaje: 'Producto creado', id_producto: r.insertId });
  } catch (e) { err(res, e); }
});
app.put('/api/productos/:id', async (req, res) => {
  try {
    const { id_categoria, nombre, descripcion, precio, disponible } = req.body;
    if (precioInvalido(precio)) return res.status(400).json({ error: 'El precio debe ser mayor que 0' });
    const [existe] = await db.query('SELECT id_producto FROM productos WHERE id_producto = ?', [req.params.id]);
    if (!existe.length) return res.status(404).json({ error: 'Producto no encontrado' });
    await db.query(
      'UPDATE productos SET id_categoria = ?, nombre = ?, descripcion = ?, precio = ?, disponible = ? WHERE id_producto = ?',
      [id_categoria, nombre, descripcion ?? null, precio, disponible ?? true, req.params.id]
    );
    res.json({ mensaje: 'Producto actualizado' });
  } catch (e) { err(res, e); }
});
app.delete('/api/productos/:id', async (req, res) => {
  try {
    const [r] = await db.query('DELETE FROM productos WHERE id_producto = ?', [req.params.id]);
    r.affectedRows ? res.json({ mensaje: 'Producto eliminado' }) : res.status(404).json({ error: 'Producto no encontrado' });
  } catch (e) { err(res, e); }
});

app.get('/api/categorias', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM categorias ORDER BY id_categoria');
    res.json(rows);
  } catch (e) { err(res, e); }
});
app.get('/api/usuarios', async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT id_usuario, id_rol, nombres, apellidos, documento, correo, telefono, estado, fecha_registro
      FROM usuarios ORDER BY id_usuario`);
    res.json(rows);
  } catch (e) { err(res, e); }
});

app.get('/api/pedidos/:id', async (req, res) => {
  try {
    const [p] = await db.query('SELECT * FROM pedidos WHERE id_pedido = ?', [req.params.id]);
    if (!p.length) return res.status(404).json({ error: 'Pedido no encontrado' });
    const [det] = await db.query(`SELECT d.*, pr.nombre FROM detalle_pedido d
      JOIN productos pr ON pr.id_producto = d.id_producto WHERE d.id_pedido = ?`, [req.params.id]);
    res.json({ ...p[0], detalle: det });
  } catch (e) { err(res, e); }
});
app.post('/api/pedidos', async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { id_usuario, numero_mesa, items } = req.body; // items: [{id_producto, cantidad}]
    await conn.beginTransaction();
    const [r] = await conn.query('INSERT INTO pedidos (id_usuario, numero_mesa) VALUES (?,?)', [id_usuario, numero_mesa]);
    let total = 0;
    for (const it of items) {
      const [[prod]] = await conn.query('SELECT precio FROM productos WHERE id_producto = ?', [it.id_producto]);
      if (!prod) throw new Error('Producto ' + it.id_producto + ' no existe');
      await conn.query('INSERT INTO detalle_pedido (id_pedido,id_producto,cantidad,precio_unitario) VALUES (?,?,?,?)',
        [r.insertId, it.id_producto, it.cantidad, prod.precio]);
      total += prod.precio * it.cantidad;
    }
    await conn.query('UPDATE pedidos SET total = ? WHERE id_pedido = ?', [total, r.insertId]);
    await conn.commit();
    res.status(201).json({ mensaje: 'Pedido creado', id_pedido: r.insertId, total });
  } catch (e) { await conn.rollback(); err(res, e); } finally { conn.release(); }
});
app.patch('/api/pedidos/:id/estado', async (req, res) => {
  try {
    const estados = ['pendiente', 'en_preparacion', 'servido', 'pagado', 'cancelado'];
    if (!estados.includes(req.body.estado)) return res.status(400).json({ error: 'Estado no válido' });
    const [existe] = await db.query('SELECT id_pedido FROM pedidos WHERE id_pedido = ?', [req.params.id]);
    if (!existe.length) return res.status(404).json({ error: 'Pedido no encontrado' });
    await db.query('UPDATE pedidos SET estado = ? WHERE id_pedido = ?', [req.body.estado, req.params.id]);
    res.json({ mensaje: 'Estado actualizado' });
  } catch (e) { err(res, e); }
});
app.delete('/api/pedidos/:id', async (req, res) => {
  try {
    const [r] = await db.query('DELETE FROM pedidos WHERE id_pedido = ?', [req.params.id]);
    r.affectedRows ? res.json({ mensaje: 'Pedido eliminado' }) : res.status(404).json({ error: 'Pedido no encontrado' });
  } catch (e) { err(res, e); }
});

app.listen(3000, () => console.log('API RestoGest en http://localhost:3000'));
