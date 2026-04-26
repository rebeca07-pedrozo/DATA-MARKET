/**
 * Pipeline principal de limpieza y transformación de datos.
 * Lee las respuestas del formulario, las normaliza y las escribe
 * en la hoja 'limpieza' en formato listo para ECLAT.
 *
 * Arquitectura Medallion:
 *   Bronze → 'Respuestas de formulario 1' (datos crudos del Forms)
 *   Silver → 'limpieza' (datos normalizados, one-hot encoded)
 *   Gold   → resultados de ECLAT en Google Colab
 */
function pipelineLimpiezaEclatFinal() {

  // ── Conexión a las hojas ──────────────────────────────────────────────────
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const hojaOrigen  = ss.getSheetByName("Respuestas de formulario 1"); // Bronze
  const hojaDestino = ss.getSheetByName("limpieza");                   // Silver

  // Crear la hoja destino si no existe
  if (!hojaDestino) ss.insertSheet("limpieza");

  // Leer todos los datos y eliminar la fila de cabeceras (slice(1))
  const datos = hojaOrigen.getDataRange().getValues();
  const filas = datos.slice(1);


  // ── 1. NORMALIZACIÓN GEOGRÁFICA ───────────────────────────────────────────
  // Las ciudades llegan en texto libre desde el formulario (con errores
  // tipográficos, mayúsculas inconsistentes, abreviaciones, etc).
  // Esta función estandariza todo a un nombre canónico único.
  const normalizarCiudad = (ciudad) => {
    let c = ciudad.toString().toLowerCase().trim();

    if (c.includes("banco"))       return "El Banco";
    if (c.includes("bogot"))       return "Bogotá";
    if (c.includes("barranquilla"))return "Barranquilla";
    if (c.includes("marta"))       return "Santa Marta";
    if (c.includes("valledupar"))  return "Valledupar";
    if (c.includes("sincelejo"))   return "Sincelejo";
    if (c.includes("bucaramanga")) return "Bucaramanga";
    if (c.includes("fundaci"))     return "Fundación";

    // Medellín tiene múltiples variantes comunes → todas al mismo nombre
    if (c.includes("medellin") || c.includes("medellín") ||
        c.includes("paisa")    || c.includes("antioquia")) return "Medellín";

    // Si no coincide con ninguna regla, devuelve el texto original
    // con la primera letra en mayúscula como fallback
    return ciudad.toString().trim();
  };


  // ── 2. LISTAS MAESTRAS ────────────────────────────────────────────────────
  // Definen el universo completo de productos y canales que se rastrean.
  // El orden aquí determina el orden de las columnas en la hoja destino.
  // Cualquier producto nuevo debe agregarse aquí para que quede en el pipeline.

  const PRODUCTOS_MAESTROS = [
    // Frescos
    "Carne", "Cerdo", "Pollo", "Pescado", "Leche", "Queso", "Frutas", "Verduras",
    // Básicos
    "Arroz", "Pasta", "Harina", "Papa", "Platano", "Huevos",
    "Azucar", "Sal", "Panela", "Aceite", "Yuca",
    // Despensa
    "Café", "Chocolate", "Fríjol", "Lentejas", "Pan",
    "Mantequilla", "Galletas", "Dulces", "Jugos", "Agua",
    // Delikatessen
    "Aceitunas", "Carnes maduras", "Quesos especiales",
    "Vinos/Licores", "Productos importados",
    // Aseo
    "Jabón de baño", "Champú", "Acondicionador",
    "Detergente en polvo / líquido", "Lavaloza",
    "Papel higiénico", "Crema dental", "Desodorante",
    "Seda dental", "Enjuague bucal", "Suavizante"
  ];

  const ALMACENES_MAESTROS = [
    "Hard Discount", "Grandes Superficies", "Tienda de Barrio",
    "Plaza de Mercado", "App / Domicilios"
  ];


  // ── 3. CABECERAS DE LA HOJA DESTINO ──────────────────────────────────────
  // Se construyen dinámicamente desde las listas maestras.
  // Canales → prefijo "Canal_" + primera palabra del nombre (ej: Canal_Hard)
  // Productos → prefijo "Prod_" + nombre completo (ej: Prod_Carne)
  const cabeceras = [
    "Timestamp", "Genero", "Edad", "Ciudad_Normalizada", "Estrato",
    "Hogar_Size", "Responsabilidad", "Presupuesto", "Frecuencia",
    "Motivacion_General", "Regalo_Gustito",
    ...ALMACENES_MAESTROS.map(a => "Canal_" + a.split(" ")[0]),
    ...PRODUCTOS_MAESTROS.map(p => "Prod_" + p)
  ];

  // Matriz final que se escribirá en la hoja (empieza con las cabeceras)
  let matrizLimpia = [cabeceras];


  // ── 4. TRANSFORMACIÓN FILA POR FILA ──────────────────────────────────────
  filas.forEach(fila => {

    // Consolidar todas las columnas de compras en un solo string en minúsculas.
    // Las columnas 11-22 corresponden a las preguntas de productos del formulario.
    // Se unen con coma para hacer una sola búsqueda de texto por producto.
    let comprasRaw = [
      fila[11], fila[12], fila[13], fila[14], fila[15], fila[16],
      fila[17], fila[18], fila[19], fila[20], fila[22]
    ].join(", ").toString().toLowerCase();

    // Normalizar la variable de responsabilidad de compra.
    // La pregunta tenía texto libre → se mapea a 3 categorías fijas.
    let respRaw   = fila[6].toString().toLowerCase();
    let respLimpia = respRaw.includes("decisiones") ? "Individual"
                   : respRaw.includes("comparto")   ? "Compartida"
                   : "Delegada";

    // Construir la fila procesada con las variables demográficas limpias
    let filaProcesada = [
      fila[0],                    // Timestamp (sin transformación)
      fila[1],                    // Género
      fila[2],                    // Edad
      normalizarCiudad(fila[3]),  // Ciudad → normalizada
      fila[4],                    // Estrato
      fila[5],                    // Tamaño del hogar
      respLimpia,                 // Responsabilidad → categoría limpia
      fila[7],                    // Presupuesto mensual
      fila[9],                    // Frecuencia de compra
      fila[21],                   // Motivación general
      fila[22]                    // Regalo / gustito
    ];

    // One-hot encoding de canales:
    // Si el nombre del almacén aparece en la respuesta → 1, si no → 0
    ALMACENES_MAESTROS.forEach(a =>
      filaProcesada.push(fila[10].toString().includes(a) ? 1 : 0)
    );

    // One-hot encoding de productos:
    // Busca el nombre del producto (en minúsculas) dentro del string
    // consolidado de todas las respuestas de compra.
    // Si aparece → 1 (lo compra), si no → 0 (no lo compra)
    PRODUCTOS_MAESTROS.forEach(p => {
      let pLower = p.toLowerCase();
      filaProcesada.push(comprasRaw.includes(pLower) ? 1 : 0);
    });

    matrizLimpia.push(filaProcesada);
  });


  // ── 5. ESCRITURA EN LA HOJA DESTINO ──────────────────────────────────────
  // Se limpia la hoja primero para evitar datos residuales de ejecuciones
  // anteriores, luego se escribe toda la matriz de una vez (más eficiente
  // que escribir fila por fila).
  hojaDestino.clear();
  hojaDestino.getRange(1, 1, matrizLimpia.length, matrizLimpia[0].length)
             .setValues(matrizLimpia);

  // Formato visual de la cabecera: negrita, color de fondo, centrado
  hojaDestino.getRange(1, 1, 1, cabeceras.length)
             .setFontWeight("bold")
             .setBackground("#AEECEF")
             .setHorizontalAlignment("center");

  // Congelar la primera fila para facilitar la navegación
  hojaDestino.setFrozenRows(1);

  // Ajustar el ancho de columnas automáticamente al contenido
  hojaDestino.autoResizeColumns(1, cabeceras.length);
}
