"""Genera los íconos de la app (Android, splash, web y escritorio).

    python scripts/generar-iconos.py

Diseño: una "F" condensada (Anton) con degradado metálico, un destello y un
brillo violeta tenue sobre fondo casi negro, como en el diseño aprobado.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
FUENTE = RAIZ / "node_modules/@expo-google-fonts/anton/400Regular/Anton_400Regular.ttf"
FONDO = (8, 9, 11, 255)
VIOLETA = (154, 141, 242)


def degradado_metal(ancho: int, alto: int) -> Image.Image:
    """Blanco → plata → gris, de arriba hacia abajo."""
    img = Image.new("RGBA", (ancho, alto))
    paradas = [(0.0, (255, 255, 255)), (0.46, (217, 219, 224)), (1.0, (139, 143, 152))]
    px = img.load()
    for y in range(alto):
        t = y / max(1, alto - 1)
        for i in range(len(paradas) - 1):
            (t0, c0), (t1, c1) = paradas[i], paradas[i + 1]
            if t0 <= t <= t1:
                k = (t - t0) / (t1 - t0)
                color = tuple(round(c0[j] + (c1[j] - c0[j]) * k) for j in range(3))
                break
        for x in range(ancho):
            px[x, y] = (*color, 255)
    return img


def marca(tam: int, escala: float, monocromo: bool = False) -> Image.Image:
    """La "F" con destello, centrada en un lienzo transparente de tam×tam."""
    lienzo = Image.new("RGBA", (tam, tam), (0, 0, 0, 0))
    fuente = ImageFont.truetype(str(FUENTE), int(tam * 0.62 * escala))
    mascara = Image.new("L", (tam, tam), 0)
    d = ImageDraw.Draw(mascara)
    caja = d.textbbox((0, 0), "F", font=fuente)
    w, h = caja[2] - caja[0], caja[3] - caja[1]
    x = (tam - w) / 2 - caja[0] - tam * 0.03 * escala
    y = (tam - h) / 2 - caja[1]
    d.text((x, y), "F", font=fuente, fill=255)

    # Destello de 4 puntas a la derecha de la F.
    cx, cy, r = tam / 2 + w * 0.62, tam / 2 + h * 0.18, tam * 0.075 * escala
    destello = [
        (cx, cy - r), (cx + r * 0.22, cy - r * 0.22), (cx + r, cy), (cx + r * 0.22, cy + r * 0.22),
        (cx, cy + r), (cx - r * 0.22, cy + r * 0.22), (cx - r, cy), (cx - r * 0.22, cy - r * 0.22),
    ]
    d.polygon(destello, fill=255)

    relleno = Image.new("RGBA", (tam, tam), (255, 255, 255, 255)) if monocromo else degradado_metal(tam, tam)
    lienzo.paste(relleno, (0, 0), mascara)
    return lienzo


def con_fondo(tam: int, escala: float, esquinas: float = 0.0) -> Image.Image:
    base = Image.new("RGBA", (tam, tam), FONDO)
    # Brillo violeta difuso arriba a la derecha.
    brillo = Image.new("RGBA", (tam, tam), (0, 0, 0, 0))
    ImageDraw.Draw(brillo).ellipse(
        (tam * 0.35, -tam * 0.35, tam * 1.35, tam * 0.65), fill=(*VIOLETA, 70)
    )
    base = Image.alpha_composite(base, brillo.filter(ImageFilter.GaussianBlur(tam * 0.12)))
    base = Image.alpha_composite(base, marca(tam, escala))
    if esquinas:
        m = Image.new("L", (tam, tam), 0)
        ImageDraw.Draw(m).rounded_rectangle((0, 0, tam - 1, tam - 1), radius=int(tam * esquinas), fill=255)
        recortado = Image.new("RGBA", (tam, tam), (0, 0, 0, 0))
        recortado.paste(base, (0, 0), m)
        return recortado
    return base


def guardar(img: Image.Image, ruta: Path, tam: int | None = None) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    (img.resize((tam, tam), Image.LANCZOS) if tam else img).save(ruta)
    print("✓", ruta.relative_to(RAIZ))


if __name__ == "__main__":
    movil = RAIZ / "apps/mobile/assets"
    guardar(con_fondo(1024, 1.0), movil / "icon.png")
    guardar(marca(1024, 0.72), movil / "android-icon-foreground.png")  # zona segura del ícono adaptable
    guardar(marca(1024, 0.72, monocromo=True), movil / "android-icon-monochrome.png")
    guardar(marca(512, 1.0), movil / "splash-icon.png")
    guardar(con_fondo(1024, 1.0, esquinas=0.22), movil / "favicon.png", 48)

    web = RAIZ / "apps/web/public"
    guardar(con_fondo(1024, 1.0, esquinas=0.22), web / "icono-512.png", 512)
    guardar(con_fondo(1024, 1.0, esquinas=0.22), web / "icono-192.png", 192)
    guardar(con_fondo(1024, 0.8), web / "icono-maskable-512.png", 512)
    guardar(con_fondo(1024, 1.0, esquinas=0.22), web / "favicon.png", 64)
    guardar(con_fondo(1024, 1.0, esquinas=0.22), web / "apple-touch-icon.png", 180)
    # Fuente para `tauri icon` (genera .ico y demás tamaños del escritorio).
    guardar(con_fondo(1024, 1.0, esquinas=0.22), RAIZ / "apps/web/src-tauri/icono-fuente.png")
