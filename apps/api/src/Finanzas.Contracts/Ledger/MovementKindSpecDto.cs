namespace Finanzas.Contracts.Ledger;

/// <summary>
/// Tabla de invariantes por clase de movimiento, publicada <b>como dato</b>
/// (decisión de <c>HANDOFF.md</c> §1).
/// </summary>
/// <remarks>
/// <para><b>Por qué viaja al cliente.</b> El formulario dinámico necesita saber
/// qué campos pedir para cada clase de movimiento: si la tabla se reescribe en
/// TypeScript, existen dos verdades y la del navegador se desactualiza en
/// silencio. Aquí el frontend construye el formulario a partir de la misma
/// tabla que el dominio usa para validar.</para>
/// <para><b>No es la validación.</b> Sirve para no ofrecer lo imposible y para
/// avisar antes de enviar. La palabra final la tiene el servidor: un cliente que
/// omita esta comprobación recibe un error, no un movimiento ilegal.</para>
/// </remarks>
/// <param name="Kind">Clase descrita.</param>
/// <param name="AllowedEffects">Efectos económicos admitidos.</param>
/// <param name="AllowedFlows">Flujos de caja admitidos.</param>
/// <param name="RequiredLinks">Enlaces que deben estar presentes.</param>
/// <param name="ForbiddenLinks">
/// Enlaces que no pueden estar presentes. La categoría aparece aquí en todo
/// movimiento siempre neutro: categorizar un traslado lo haría figurar en los
/// reportes de gasto además del gasto real (regla financiera 2).
/// </param>
/// <param name="ExactlyOneOfLinks">
/// Grupo del que debe estar presente exactamente uno. Vacío si la clase no
/// impone esa disyuntiva.
/// </param>
/// <param name="IsAlwaysNeutral">La clase nunca es ingreso ni gasto.</param>
public sealed record MovementKindSpecDto(
    MovementKindDto Kind,
    IReadOnlyList<EconomicEffectDto> AllowedEffects,
    IReadOnlyList<CashFlowDto> AllowedFlows,
    IReadOnlyList<MovementLinkDto> RequiredLinks,
    IReadOnlyList<MovementLinkDto> ForbiddenLinks,
    IReadOnlyList<MovementLinkDto> ExactlyOneOfLinks,
    bool IsAlwaysNeutral);
