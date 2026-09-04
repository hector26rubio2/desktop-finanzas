namespace Finanzas.Contracts.Common;

/// <summary>
/// Error de negocio. Viaja en el cuerpo de una respuesta con estado HTTP de
/// error; no existe un envoltorio <c>Result&lt;T&gt;</c> en las respuestas
/// correctas (decisión de <c>HANDOFF.md</c> §1).
/// </summary>
/// <remarks>
/// <para><b>El código manda.</b> <see cref="Code"/> es el identificador estable
/// contra el que el cliente decide qué hacer y qué mensaje traducir.
/// <see cref="Message"/> es texto para humanos y puede cambiar de redacción sin
/// previo aviso: ramificar sobre él es un defecto.</para>
/// <para><see cref="Fields"/> se usa cuando el error señala campos concretos de
/// un formulario. Vacío no es lo mismo que ausente: un error de invariante no
/// pertenece a ningún campo.</para>
/// </remarks>
/// <param name="Code">Código estable, p. ej. <c>movement.link.forbidden</c>.</param>
/// <param name="Message">Explicación para la persona, ya redactada en español.</param>
/// <param name="Fields">Campos señalados, si el error es de formulario.</param>
public sealed record ErrorDto(
    string Code,
    string Message,
    IReadOnlyList<ErrorFieldDto>? Fields = null);

/// <summary>Campo concreto señalado por un error.</summary>
/// <param name="Field">Ruta del campo tal como la envió el cliente.</param>
/// <param name="Code">Código estable del fallo de ese campo.</param>
/// <param name="Message">Explicación para la persona.</param>
public sealed record ErrorFieldDto(string Field, string Code, string Message);
