import zipfile
import xml.etree.ElementTree as ET
import os
from loguru import logger

def point_in_polygon(x, y, poly):
    """
    Ray-casting algorithm para determinar si un punto (x, y) está dentro de un polígono.
    poly: lista de tuplas (x, y)
    """
    n = len(poly)
    if n < 3:
        return False
    inside = False
    p1x, p1y = poly[0]
    for i in range(1, n + 1):
        p2x, p2y = poly[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xints = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xints:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside

class KMZMatcher:
    def __init__(self, kmz_dir: str):
        self.kmz_dir = kmz_dir
        self.polygons = [] # List of dicts: {'name': str, 'city': str, 'points': [(lon, lat), ...]}
        self.load_all()
        
    def load_all(self):
        if not os.path.exists(self.kmz_dir):
            logger.warning(f"El directorio KMZ no existe: {self.kmz_dir}")
            return
            
        for file in os.listdir(self.kmz_dir):
            if file.lower().endswith(".kmz"):
                self.load_kmz(os.path.join(self.kmz_dir, file), file)

    def load_kmz(self, filepath: str, filename: str):
        city = "UNKNOWN"
        if "CBBA" in filename.upper() or "COCHABAMBA" in filename.upper():
            city = "CBB"
        elif "PAZ" in filename.upper():
            city = "LPZ"
        elif "SCZ" in filename.upper() or "SANTA CRUZ" in filename.upper():
            city = "SCZ"

        logger.info(f"Cargando polígonos desde {filename} para {city}")
        
        try:
            with zipfile.ZipFile(filepath, 'r') as kmz:
                for item in kmz.namelist():
                    if item.lower().endswith(".kml"):
                        kml_data = kmz.read(item)
                        self.parse_kml(kml_data, city)
        except Exception as e:
            logger.error(f"Error procesando {filename}: {e}")

    def parse_kml(self, kml_data: bytes, city: str):
        # Eliminar namespaces para simplificar la busqueda
        try:
            it = ET.iterparse(import_io(kml_data)) # type: ignore
            for _, el in it:
                _, _, el.tag = el.tag.rpartition('}') 
            root = it.root
        except Exception:
            # Fallback a string manipulation si namespaces complican mucho
            import re
            kml_str = kml_data.decode('utf-8', errors='ignore')
            kml_str = re.sub(r' xmlns="[^"]+"', '', kml_str, count=1)
            root = ET.fromstring(kml_str)

        namespace = {'kml': 'http://www.opengis.net/kml/2.2'}
        
        # Búsqueda manual sin namespaces por la limpieza anterior
        for placemark in root.iter('Placemark'):
            name_el = placemark.find('name')
            name = name_el.text if name_el is not None else "Unnamed"
            
            for coordinates in placemark.iter('coordinates'):
                coords_str = coordinates.text
                if not coords_str:
                    continue
                
                points = []
                for pt in coords_str.strip().split():
                    parts = pt.split(',')
                    if len(parts) >= 2:
                        lon = float(parts[0])
                        lat = float(parts[1])
                        points.append((lon, lat))
                
                if len(points) >= 3:
                    self.polygons.append({
                        'name': name,
                        'city': city,
                        'points': points
                    })
                    
    def find_zone(self, lat: float, lon: float, city: str) -> str:
        """Devuelve el nombre del Placemark (zona/subzona) donde cae el punto."""
        if lat is None or lon is None:
            return ""
            
        for poly in self.polygons:
            if poly['city'] == city or poly['city'] == "UNKNOWN":
                if point_in_polygon(lon, lat, poly['points']):
                    return poly['name']
        return ""

# Helper to wrap bytes for ElementTree
def import_io(data: bytes):
    import io
    return io.BytesIO(data)
