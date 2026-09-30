# Gráficos Cuantificación de la Oferta Nueva:

## para esta nueva pestaña se van a trabajar los puntos de nuevos gráficos que va mostrar y pestanas que se van a crear.

1. en el panel secundario header donde están las pestañas de proyectos, tipologías y mapa se van aumentar nuevas pestañas con los nuevos:
 * Stock en ventas
     (Unidades)

 * Stock en Ventas
        (USD)

 * Ritmo de Ventas

 * Meses de Stock
 
 * Análisis de Producto

iniciemos con eso primero, una vez tengamos listo esto vamos avanzando con los demás puntos.

-----------------------------------------------------------------------------------------------

## continuamos con la tarea 2. Ahora la nueva pestaña de "stock en ventas (unidades)" deben de existir solo tres cuadros de resultados y no cuatro como aurita se muestra:

El primera cuadro de resultados=(kpi). debe mostrar en datos enteros la "cantidad de proyectos activos"= proyectos en etapas de preventas, obra bruta, obra fina y terminada., más su comparación de resultados anteriores en datos métricos. 

El segundo cuadro de resultados=(kpi). debe mostrar en datos enteros la "cantidad de proyectos vendidos"= proyectos en etapas de vendida., más su comparación de resultados anteriores en datos métricos.

El tercer cuadro de resultados=(kpi). debe mostrar en datos enteros la "cantidad de proyectos inactivos"= proyectos en etapas paralizadas y clandestinas., más su comparación de resultados anteriores en datos métricos.

> aclarar que debemos mantener el mismo formato gráficos que ya existe. solo vamos a simplificar ah estos estos tres cuadros de resultados=(kpi). 
-------------------------------------------------------------------------------------------------

## Procedamos con la tarea 3. vamos a sustituir la grafica de barras laterales por tres gráficos:

el primer gráfico va estar integrado al primer cuadro de resultados "cantidad de proyectos activos". va ser un grafico de torta donde cada etapa va representar un color. Preventa="#59aef4", Obra bruta="#ffcd04", Obra fina="#175192" y Terminada="#0e9d58" la grafica debe ser dinámico.

el segundo gráfico va estar integrado al segundo cuadro de resultados "cantidad de proyectos vendidos". va ser un grafico de torta donde cada etapa va representar un color. Vendida="rojo" la grafica debe ser dinámico. 

el tercer gráfico va estar integrado al tercer cuadro de resultados "cantidad de proyectos inactivos". va ser un grafico de torta donde cada etapa va representar un color. Paralizada="rojo sangrienta" y la Clandestina="rojo claro" la grafica debe ser dinámico. 

mantenemos los datos que muestran "proyectos analizados" y "zonas activas" que están en el pie de la pagina izquierda.

quitamos: los datos "Vendidos" y "por vender" que están en el pie de la pagina derecha, el titulo de indicadores y el filtro. 

añadimos una nueva pestaña que va ser "Mapa" que acompañen a los "Gráficos" y "Tabla de Proyectos" esta nueva pestaña llamada mapa que es el mismo que ya tenemos la única diferencia es que no va afectar el espacio donde se muestran los cuadros de resultados. ese espacio va estar fijo.
 
--------------------------------------------------------------------------------------------

### ajustando algunos detalles de la tarea 3.

añadamos títulos a los gráficos de cada pestaña:

en la pestaña "Gráficos" donde se visualiza las tortas. en el espacio donde estaba el titulo anterior de Indicadores, que ocupe ese espacio el Titulo : "Segmentación por Etapas".

en la pestaña de "Tabla de Proyectos" donde se visualiza la lista de datos. que tenga como Titulo : "Lista de Proyectos".

en la pestaña de "Mapa" donde se visualiza una vista geoespacial de cada proyecto. que tenga como Titulo : "Localización de Proyectos".

en los graficos de las visualizaciones de las torta se identifico una anomalia. cuando se cambia de ciudades como ej. Cochabamba, obvio no hay proyectos vendido ni tampaco proyectos inactivos. Pero cuando vuelvo a la ciudad de santa cruz, el mensaje de "0 proyectos en etapa vendida" y "0 inactivos" encima de los graficos. que muestran datos que si existen en santa cruz y la paz.

> Y en el grafico del mapa quita los icono de zoon del mapa (+/-). El titulo de "Vista Geoespacial Gis" quita simplemente la palabra "GIS", quita la pestaña de "capas qgis" y ajusta el visualizador de mapa, porque cuando giro el ratón hacia abajo se oculta parte de los comandos y la parte inferior se nota que parece que esta debajo de los paneles ocultando así el cuadro de representaciones.
-----------------------------------------------------------------------------------------------

> un detalle que encontré y debemos corregir. al momento de filtra por esta de obra en la vista de mapa aun sigue con el formato anterior. debemos de actualizarlo con los colores de que ya le hemos  asignado a cada etapa sus verdaderos nombre de etapas. 
----------------------------------------------------------------
Debemos hacer una corrección. cambia el nombre de la pestaña "Stock en Ventas (Unidades)" por "Resumen General" y crea una nueva pestaña con el nombre de "Stock en Ventas (Unidades)" seguida de la pestaña "Resumen General".

----------------------------------------------------------------
## avanzamos a la tarea 4. en la pestaña de "Stock en Ventas (Unidades)" actualmente hay cuatro cuadros de resultados=(kpi), debemos añadir un cuadro más. total deben ser cinco cuadro de resultados>

El primera cuadro de resultados=(kpi). debe mostrar en datos enteros del "Stock total en Oferta"= total de la tabla de oferta_indicadores_censo/ de la columna und_por_vender/ de la data de supabase, más su comparativa con el censo anterior donde muestra el total del stock inicial más sus datos métricos.

El segundo cuadro de resultados=(kpi). debe mostrar en datos enteros del "Promedio Vendido por Proyecto"=promedio de la tabla de oferta_indicadores_censo/ de la columna und_vendidas/ de la data de supabase, más su comparativa con el censo anterior donde muestra el total de las unidades vendidas más sus datos métricos.

El tercer cuadro de resultados=(kpi). debe mostrar en datos porcentuales del "Porcentaje Vendido"= total de la tabla de oferta_indicadores_censo/ de la columna und_vendidas/ dividido con la columna und_totales/ de la data de supabase, más su comparativa con el censo anterior donde muestra el total de las unidades por vender más sus datos métricos.

El cuarto cuadro de resultados=(kpi). debe mostrar en datos enteros del "Promedio por Vender por Proyecto"=promedio de la tabla de oferta_indicadores_censo/ de la columna und_por_vender/ de la data de supabase, más su comparativa con el censo anterior donde muestra el total de las unidades por vender más sus datos métricos.

El quinto cuadro de resultados=(kpi). debe mostrar en datos porcentuales del "Porcentaje por Vender"= total de la tabla de oferta_indicadores_censo/ de la columna und_por_vender/ dividido con la columna und_totales/ de la data de supabase, más su comparativa con el censo anterior donde muestra el total de las unidades por vender más sus datos métricos.

> aclarar que debemos mantener el mismo formato gráficos que ya existe. solo vamos a aumentar ah cinco cuadros de resultados=(kpi).
-----------------------------------------------------------------------------------------------------------

## avanzamos con la tarea 5. las grafica de barras laterales, vamos añadir 2 graficas de barras laterales:

(la anterior tarea era la 4.)

la primera grafica de barras laterales va ser el mismo que ya presenta que son los stock por unidades por zona. la diferencia es que las zonas deben ser las que estan en la columna ZONAS/ de la tabla oferta_proyectos de la data de supabase. 

la segunda grafica de barra laterales va ser el mismo que ya presenta que son los stock vendidos por unidades por zona. la diferencia es que las zonas deben ser las que estan en la columna ZONAS/ de la tabla oferta_proyectos de la data de supabase.

en los pies de pagina de la grafica se mantendran los datos que muestran "proyectos analizados","zonas activas","vendidas","por vender" y ahora se va añadir un nuevo dato "promedio Stock Incial" seguida de "zonas activas".

cambiamos el titulo de Indicadores por "Stock por Unidades".

el filtro de que esta a lado del titulo de Indicadores mantenerlo con la modificación quitar las opciones de "evolucion historica","ritmo de venta por zona","monto usd por zona","meses de stock por zona" quedando solo las opciones de selección "Stock por Zona" y "stock por Subzona".

mencionó que si el filtro de cambia a stock por subzona las graficas de barras laterales deben de cambiar/actualizarse con los datos que corresponden de las subzonas.

el color de las barras laterales para el stock por vender="#1565c0" y para las barras laterales que son los stock vendidos="#ef4444"

> como detalle para toda la plataforma ajusta los textos y separadores para garantizar legibilidad y contraste. 
----------------------------------------------------------------------------------------------------------

