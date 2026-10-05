"""Genera los íconos de la app (Android, splash, web y escritorio).

    python scripts/generar-iconos.py

Diseño "Barras": una F redondeada de plata cuyo brazo medio es una barra de
progreso violeta (una meta llenándose) sobre un azulejo casi negro con un brillo
violeta arriba a la derecha. Las medidas están en un lienzo de 1024 px (las
mismas que apps/web/src/componentes/Logo.tsx) y las figuras se dibujan a 4× para
que los bordes salgan suaves.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

RAIZ = Path(__file__).resolve().parent.parent
LADO = 1024  # lienzo de diseño
SS = 4  # sobremuestreo para el antialiasing
VIOLETA = (154, 141, 242)
METAL = [(0.0, (255, 255, 255)), (0.45, (226, 227, 231)), (1.0, (143, 147, 156))]
BARRA = [(0.0, (122, 108, 224)), (1.0, (212, 206, 255))]
AZULEJO = [(0.0, (28, 29, 35)), (1.0, (9, 9, 11))]
MARGEN, ESQUINAS = 40, 216  # azulejo redondeado (escritorio y web)


def _a_px(c: float, tam: int, escala: float) -> float:
    """Coordenada de diseño → píxel del lienzo final, escalando la marca desde el centro."""
    return (LADO / 2 + (c - LADO / 2) * escala) * tam / LADO


def _mascara(tam: int, dibujar) -> Image.Image:
    m = Image.new("L", (tam * SS, tam * SS), 0)
    dibujar(ImageDraw.Draw(m), lambda c: _a_px(c, tam, 1) * SS)
    return m.resize((tam, tam), Image.LANCZOS)


def _pastilla(tam: int, escala: float, x0, y0, x1, y1, r) -> Image.Image:
    def dibujar(d, _):
        p = lambda c: _a_px(c, tam, escala) * SS
        d.rounded_rectangle((p(x0), p(y0), p(x1), p(y1)), radius=r * escala * tam / LADO * SS, fill=255)

    return _mascara(tam, dibujar)


def _mascara_f(tam: int, escala: float) -> Image.Image:
    def dibujar(d, _):
        p = lambda c: _a_px(c, tam, escala) * SS
        r = 62 * escala * tam / LADO * SS
        d.rounded_rectangle((p(294), p(232), p(418), p(792)), radius=r, fill=255)  # palo
        d.rounded_rectangle((p(294), p(232), p(740), p(356)), radius=r, fill=255)  # brazo superior
        d.rectangle((p(418), p(356), p(440), p(378)), fill=255)  # curva interior entre ambos
        d.ellipse((p(418), p(356), p(462), p(400)), fill=0)

    return _mascara(tam, dibujar)


def _degradado(tam: int, paradas, eje: str, a: float, b: float, escala: float = 1.0) -> Image.Image:
    """Degradado RGB a lo largo de un eje, de la coordenada de diseño a hasta la b."""
    pos = (np.arange(tam) + 0.5) * LADO / tam
    pos = LADO / 2 + (pos - LADO / 2) / escala
    t = np.clip((pos - a) / (b - a), 0, 1)
    ts = [p[0] for p in paradas]
    cols = np.array([p[1] for p in paradas], dtype=float)
    linea = np.stack([np.interp(t, ts, cols[:, j]) for j in range(3)], axis=-1)
    img = np.repeat(linea[:, None, :], tam, axis=1) if eje == "y" else np.repeat(linea[None, :, :], tam, axis=0)
    return Image.fromarray(img.round().astype(np.uint8), "RGB")


def _pintar(base: Image.Image, relleno, mascara: Image.Image, opacidad: float = 1.0) -> Image.Image:
    if isinstance(relleno, tuple):
        relleno = Image.new("RGB", base.size, relleno)
    capa = relleno.convert("RGBA")
    capa.putalpha(mascara if opacidad == 1 else mascara.point(lambda v: round(v * opacidad)))
    return Image.alpha_composite(base, capa)


def marca(tam: int, escala: float, monocromo: bool = False) -> Image.Image:
    """La F con su barra, centrada en un lienzo transparente de tam×tam."""
    lienzo = Image.new("RGBA", (tam, tam), (0, 0, 0, 0))
    barra = _pastilla(tam, escala, 356, 452, 646, 576, 62)
    if monocromo:
        return _pintar(lienzo, (255, 255, 255), ImageChops.lighter(_mascara_f(tam, escala), barra))
    lienzo = _pintar(lienzo, (255, 255, 255), _pastilla(tam, escala, 356, 452, 740, 576, 62), 0.09)  # riel
    brillo = _pastilla(tam, escala, 356, 470, 626, 566, 48).filter(ImageFilter.GaussianBlur(22 * escala * tam / LADO))
    lienzo = _pintar(lienzo, VIOLETA, brillo, 0.7)
    lienzo = _pintar(lienzo, _degradado(tam, BARRA, "x", 356, 646, escala), barra)
    return _pintar(lienzo, _degradado(tam, METAL, "y", 232, 792, escala), _mascara_f(tam, escala))


def azulejo(tam: int, redondo: bool = False, zona: float = 1.0) -> Image.Image:
    """Fondo casi negro con brillo violeta; redondo = con margen, esquinas y filo de luz.

    zona: fracción central que de verdad se ve (el ícono adaptable de Android solo
    muestra 72 de sus 108 dp), para que el brillo caiga dentro del recorte.
    """
    m = MARGEN if redondo else LADO * (1 - zona) / 2
    k = tam / LADO
    ancho = (LADO - 2 * m) * k
    base = Image.new("RGBA", (tam, tam), (0, 0, 0, 0))
    fondo = _degradado(tam, [(0, AZULEJO[0][1]), (1, AZULEJO[1][1])], "y", m, LADO - m)
    # Brillo radial: centro en (80 %, 8 %) del azulejo, radio del 80 %.
    yy, xx = np.mgrid[0:tam, 0:tam] + 0.5
    d = np.hypot(xx - (m * k + 0.8 * ancho), yy - (m * k + 0.08 * ancho)) / (0.8 * ancho)
    alfa = np.interp(d, [0, 0.55, 1], [0.42, 0.06, 0])
    fondo = Image.alpha_composite(fondo.convert("RGBA"), Image.merge("RGBA", (*Image.new("RGB", (tam, tam), VIOLETA).split(), Image.fromarray((alfa * 255).round().astype(np.uint8), "L"))))
    if not redondo:
        return fondo
    forma = _mascara(tam, lambda dib, p: dib.rounded_rectangle((p(m), p(m), p(LADO - m), p(LADO - m)), radius=ESQUINAS * k * SS, fill=255))
    base = _pintar(base, fondo.convert("RGB"), forma)
    # Filo: contorno de 3 px que se apaga de arriba hacia abajo.
    filo = _mascara(tam, lambda dib, p: dib.rounded_rectangle((p(m + 1.5), p(m + 1.5), p(LADO - m - 1.5), p(LADO - m - 1.5)), radius=(ESQUINAS - 1.5) * k * SS, outline=255, width=max(1, round(3 * k * SS))))
    luz = _degradado(tam, [(0, (56, 56, 56)), (0.3, (10, 10, 10)), (1, (5, 5, 5))], "y", m, LADO - m).convert("L")
    return _pintar(base, (255, 255, 255), ImageChops.multiply(filo, luz))


def con_fondo(tam: int, escala: float, redondo: bool = False) -> Image.Image:
    return Image.alpha_composite(azulejo(tam, redondo), marca(tam, escala))


def guardar(img: Image.Image, ruta: Path, tam: int | None = None) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    (img.resize((tam, tam), Image.LANCZOS) if tam else img).save(ruta)
    print("✓", ruta.relative_to(RAIZ))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # la consola de Windows no sabe imprimir ✓
    redondo = con_fondo(1024, 1.0, redondo=True)
    lleno = con_fondo(1024, 1.0)  # sin transparencia: el sistema le pone su propia forma

    movil = RAIZ / "apps/mobile/assets"
    guardar(lleno, movil / "icon.png")
    guardar(azulejo(1024, zona=72 / 108), movil / "android-icon-background.png")
    guardar(marca(1024, 0.72), movil / "android-icon-foreground.png")  # zona segura del ícono adaptable
    guardar(marca(1024, 0.72, monocromo=True), movil / "android-icon-monochrome.png")
    guardar(marca(512, 1.0), movil / "splash-icon.png")
    guardar(redondo, movil / "favicon.png", 48)

    web = RAIZ / "apps/web/public"
    guardar(redondo, web / "icono-512.png", 512)
    guardar(redondo, web / "icono-192.png", 192)
    guardar(con_fondo(1024, 0.8), web / "icono-maskable-512.png", 512)
    guardar(redondo, web / "favicon.png", 64)
    guardar(lleno, web / "apple-touch-icon.png", 180)
    # Fuente para `tauri icon` (genera .ico y demás tamaños del escritorio).
    guardar(redondo, RAIZ / "apps/web/src-tauri/icono-fuente.png")
