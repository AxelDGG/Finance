/** Control de porcentaje (pasos de 5 %) que no deja pasar del máximo disponible. */
export function Deslizador({ id, etiqueta, color, valor, maximo, detalle, onCambio }: { id: string; etiqueta: string; color: string; valor: number; maximo: number; detalle: string; onCambio: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#D7D9DE' }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
          {etiqueta}
        </label>
        <span style={{ fontSize: 13, color: '#9A9DA6' }}>
          <b style={{ color: '#fff', fontWeight: 600 }}>{valor}%</b> · {detalle}
        </span>
      </div>
      <input
        id={id}
        className="rng"
        type="range"
        min={0}
        max={100}
        step={5}
        value={valor}
        onChange={(e) => onCambio(Math.min(maximo, Number(e.target.value)))}
        aria-valuetext={`${valor} %, ${detalle}`}
        style={{ background: `linear-gradient(90deg, ${color} ${valor}%, rgba(255,255,255,0.08) ${valor}%)` }}
      />
    </div>
  );
}
