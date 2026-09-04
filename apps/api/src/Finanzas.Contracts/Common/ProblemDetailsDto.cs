namespace Finanzas.Contracts.Common;

/// <summary>
/// Error del transporte en formato Problem Details (RFC 9457). Viaja en el
/// cuerpo de toda respuesta con estado HTTP de error; las respuestas correctas
/// no llevan envoltorio.
/// </summary>
/// <remarks>
/// <para><b>Un identificador, dos formas.</b> El RFC exige que el tipo de
/// problema sea un URI, y una interfaz quiere una constante corta contra la que
/// ramificar. <see cref="Type"/> es <c>urn:finanzas:</c> seguido de
/// <see cref="Code"/>, siempre: no son dos identificadores que puedan
/// discrepar, sino el mismo en dos formas. El cliente compara
/// <see cref="Code"/>.</para>
/// <para><b>Qué es estable y qué no.</b> <see cref="Type"/>, <see cref="Code"/>
/// y <see cref="Status"/> son contrato. <see cref="Title"/> y
/// <see cref="Detail"/> son texto para humanos y su redacción puede cambiar sin
/// aviso: ramificar sobre ellos es un defecto.</para>
/// <para><see cref="Errors"/> se usa cuando el problema señala campos concretos
/// de un formulario. Ausente no es lo mismo que vacío: una invariante violada no
/// pertenece a ningún campo.</para>
/// </remarks>
/// <param name="Type">URI del tipo de problema: <c>urn:finanzas:</c> más el código.</param>
/// <param name="Title">Resumen corto del tipo de problema.</param>
/// <param name="Status">Estado HTTP de la respuesta, repetido en el cuerpo como manda el RFC.</param>
/// <param name="Detail">Explicación de esta ocurrencia concreta, en español.</param>
/// <param name="Instance">URI de la ocurrencia, cuando es útil para el registro.</param>
/// <param name="Code">
/// Código estable del proyecto, p. ej. <c>movement.link.forbidden</c>. Es la
/// extensión sobre la que ramifica el cliente.
/// </param>
/// <param name="Errors">Campos señalados, si el problema es de formulario.</param>
public sealed record ProblemDetailsDto(
    string Type,
    string Title,
    int Status,
    string Code,
    string? Detail = null,
    string? Instance = null,
    IReadOnlyList<ProblemFieldDto>? Errors = null);

/// <summary>Campo concreto señalado por un problema de validación.</summary>
/// <param name="Field">Ruta del campo tal como la envió el cliente.</param>
/// <param name="Code">Código estable del fallo de ese campo.</param>
/// <param name="Message">Explicación para la persona.</param>
public sealed record ProblemFieldDto(string Field, string Code, string Message);
