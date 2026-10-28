using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using System.Threading;

var builder = WebApplication.CreateBuilder(args);

// =====================================================
// HTTP CLIENTS
// =====================================================

builder.Services.AddHttpClient("openai", client =>
{
    client.BaseAddress = new Uri("https://api.openai.com/");
    client.Timeout = TimeSpan.FromSeconds(30);
});

builder.Services.AddHttpClient("liveavatar", client =>
{
    client.BaseAddress = new Uri("https://api.liveavatar.com/");
    client.Timeout = TimeSpan.FromSeconds(30);
});

// =====================================================
// CORS
// =====================================================

var origins = (
    Environment.GetEnvironmentVariable("DREALIMA_ALLOWED_ORIGINS")
    ?? "http://localhost:5500,http://127.0.0.1:5500"
).Split(
    ',',
    StringSplitOptions.RemoveEmptyEntries |
    StringSplitOptions.TrimEntries
);

builder.Services.AddCors(options =>
{
    options.AddPolicy("website", policy =>
    {
        policy.WithOrigins(origins)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// =====================================================
// RATE LIMITING
// =====================================================

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;

    options.AddFixedWindowLimiter("chat", limiter =>
    {
        limiter.PermitLimit = 12;
        limiter.Window = TimeSpan.FromMinutes(1);
        limiter.QueueLimit = 0;
    });

    options.AddFixedWindowLimiter("avatar", limiter =>
    {
        limiter.PermitLimit = 3;
        limiter.Window = TimeSpan.FromMinutes(1);
        limiter.QueueLimit = 0;
    });
});

var app = builder.Build();

app.UseCors("website");
app.UseRateLimiter();

Console.WriteLine("DREALIMA AVATAR API - VERSION 3");

// =====================================================
// HEALTH CHECK
// =====================================================

app.MapGet("/health", () =>
{
    return Results.Ok(new
    {
        status = "ok",
        service = "Drealima Avatar API",
        version = "3.0"
    });
});

// =====================================================
// OPENAI TEXT CONVERSATION
// =====================================================

app.MapPost("/api/conversation", async (
    ChatRequest req,
    IHttpClientFactory factory,
    CancellationToken ct
) =>
{
    if (string.IsNullOrWhiteSpace(req.Message) ||
        req.Message.Length > 1500)
    {
        return Results.BadRequest(new
        {
            error = "Invalid message"
        });
    }

    var apiKey = Environment.GetEnvironmentVariable(
        "OPENAI_API_KEY"
    );

    if (string.IsNullOrWhiteSpace(apiKey))
    {
        return Results.Problem(
            title: "OpenAI API key is not configured",
            statusCode: 503
        );
    }

    var language = req.Language is "en" or "de"
        ? req.Language
        : "tr";

    var instructions = """
        You are the professional female AI assistant of Drealima.

        Drealima is a software consulting and technology company.

        Main services:
        - Salesforce consulting
        - CRM solutions
        - Custom software development
        - AI automation
        - Software integrations
        - Business process digitalization

        Rules:
        - Respond in the user's selected language.
        - Supported languages: Turkish, English, German.
        - Be professional, friendly and concise.
        - Explain services clearly.
        - Never invent prices, references or guarantees.
        - Ask at most one useful follow-up question.
        - Never ask for passwords or sensitive information.
        - For quotations or appointments, direct visitors
          to the website contact form.
        - Do not claim to have booked appointments,
          sent messages or stored customer information.
        """;

    var payload = new
    {
        model = Environment.GetEnvironmentVariable(
            "OPENAI_MODEL"
        ) ?? "gpt-4.1-mini",

        max_output_tokens = 300,

        instructions = instructions +
            "\nSelected language: " + language,

        input = req.Message
    };

    try
    {
        var client = factory.CreateClient("openai");

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            "v1/responses"
        );

        request.Headers.Authorization =
            new AuthenticationHeaderValue("Bearer", apiKey);

        request.Content = new StringContent(
            JsonSerializer.Serialize(payload),
            Encoding.UTF8,
            "application/json"
        );

        using var response = await client.SendAsync(
            request,
            ct
        );

        if (!response.IsSuccessStatusCode)
        {
            Console.WriteLine(
                $"OPENAI HTTP STATUS: {(int)response.StatusCode}"
            );

            return Results.Problem(
                title: "OpenAI request failed",
                detail: $"Upstream HTTP status: {(int)response.StatusCode}",
                statusCode: 502
            );
        }

        using var document = JsonDocument.Parse(
            await response.Content.ReadAsStringAsync(ct)
        );

        var root = document.RootElement;

        if (!root.TryGetProperty("output", out var output))
        {
            return Results.Problem(
                title: "Invalid OpenAI response",
                statusCode: 502
            );
        }

        var messages = new List<string>();

        foreach (var item in output.EnumerateArray())
        {
            if (!item.TryGetProperty("content", out var content))
                continue;

            if (content.ValueKind != JsonValueKind.Array)
                continue;

            foreach (var part in content.EnumerateArray())
            {
                if (part.TryGetProperty("text", out var text))
                {
                    var value = text.GetString();

                    if (!string.IsNullOrWhiteSpace(value))
                    {
                        messages.Add(value);
                    }
                }
            }
        }

        var answer = string.Join(" ", messages).Trim();

        if (string.IsNullOrWhiteSpace(answer))
        {
            return Results.Problem(
                title: "Empty OpenAI response",
                statusCode: 502
            );
        }

        return Results.Ok(new
        {
            message = answer,
            language,
            sessionId = string.IsNullOrWhiteSpace(req.SessionId)
                ? Guid.NewGuid().ToString("N")
                : req.SessionId
        });
    }
    catch (OperationCanceledException) when (!ct.IsCancellationRequested)
    {
        return Results.Problem(
            title: "OpenAI timeout",
            statusCode: 504
        );
    }
    catch (HttpRequestException)
    {
        return Results.Problem(
            title: "OpenAI network error",
            statusCode: 502
        );
    }
    catch (JsonException)
    {
        return Results.Problem(
            title: "Invalid OpenAI JSON response",
            statusCode: 502
        );
    }
}).RequireRateLimiting("chat");

// Availability is cached in-process. No token is created by this endpoint.
app.MapGet("/api/avatar/status", () =>
{
    var configured = !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("LIVEAVATAR_API_KEY"))
        && !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("LIVEAVATAR_AVATAR_ID"))
        && !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("LIVEAVATAR_AGENT_ID"));
    var enabled = Environment.GetEnvironmentVariable("LIVEAVATAR_ENABLED") != "false";
    var available = configured && enabled && !AvatarAvailability.CreditsExhausted;
    return Results.Ok(new { liveAvatarAvailable = available, availabilityVerified = false });
});

// =====================================================
// LIVEAVATAR - CREATE SESSION TOKEN
// =====================================================

app.MapPost("/api/avatar/session", async (
    IHttpClientFactory factory,
    CancellationToken ct
) =>
{
    if (AvatarAvailability.CreditsExhausted || Environment.GetEnvironmentVariable("LIVEAVATAR_ENABLED") == "false")
        return Results.Json(new { code = "AVATAR_UNAVAILABLE", message = "Live avatar is temporarily unavailable" }, statusCode: 503);

    var apiKey = Environment.GetEnvironmentVariable(
        "LIVEAVATAR_API_KEY"
    );

    var avatarId = Environment.GetEnvironmentVariable(
        "LIVEAVATAR_AVATAR_ID"
    );

    var agentId = Environment.GetEnvironmentVariable(
        "LIVEAVATAR_AGENT_ID"
    );

    if (string.IsNullOrWhiteSpace(apiKey))
    {
        return Results.Problem(
            title: "LiveAvatar API key is missing",
            statusCode: 503
        );
    }

    if (string.IsNullOrWhiteSpace(avatarId))
    {
        return Results.Problem(
            title: "LiveAvatar avatar ID is missing",
            statusCode: 503
        );
    }

    if (string.IsNullOrWhiteSpace(agentId))
    {
        return Results.Problem(
            title: "LiveAvatar voice agent ID is missing",
            statusCode: 503
        );
    }

    var payload = new
    {
        avatar_id = avatarId,
        is_sandbox = false,
        voice_agent = new
        {
            id = agentId
        }
    };

    try
    {
        var client = factory.CreateClient("liveavatar");

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            "v1/sessions/token"
        );

        request.Headers.Add("X-API-KEY", apiKey);

        request.Content = new StringContent(
            JsonSerializer.Serialize(payload),
            Encoding.UTF8,
            "application/json"
        );

        using var response = await client.SendAsync(
            request,
            ct
        );

        Console.WriteLine(
            $"LIVEAVATAR HTTP STATUS: {(int)response.StatusCode}"
        );

        // Provider may return code 4033 in JSON even with HTTP 200.
        var responseBody = await response.Content.ReadAsStringAsync(ct);
        using var providerDoc = JsonDocument.Parse(responseBody);
        var providerRoot = providerDoc.RootElement;
        var insufficient = providerRoot.TryGetProperty("code", out var providerCode)
            && providerCode.ToString() == "4033";
        if (insufficient)
        {
            AvatarAvailability.MarkCreditsExhausted();
            Console.WriteLine("LIVEAVATAR: insufficient credits; live mode disabled until service restart");
            return Results.Json(new { code = "INSUFFICIENT_CREDITS", message = "Live avatar unavailable" }, statusCode: 503);
        }
        if (!response.IsSuccessStatusCode)
        {
            Console.WriteLine($"LIVEAVATAR HTTP STATUS: {(int)response.StatusCode}");
            return Results.Problem(title: "LiveAvatar session creation failed", statusCode: 502);
        }

        using var document = JsonDocument.Parse(
            responseBody
        );

        var root = document.RootElement;

        if (!root.TryGetProperty("data", out var data) ||
            !data.TryGetProperty("session_id", out var sessionId) ||
            !data.TryGetProperty("session_token", out var sessionToken))
        {
            return Results.Problem(
                title: "Invalid LiveAvatar response",
                statusCode: 502
            );
        }

        return Results.Ok(new
        {
            sessionId = sessionId.GetString(),
            sessionToken = sessionToken.GetString()
        });
    }
    catch (OperationCanceledException) when (!ct.IsCancellationRequested)
    {
        return Results.Problem(
            title: "LiveAvatar request timeout",
            statusCode: 504
        );
    }
    catch (HttpRequestException)
    {
        return Results.Problem(
            title: "LiveAvatar network error",
            statusCode: 502
        );
    }
    catch (JsonException)
    {
        return Results.Problem(
            title: "Invalid LiveAvatar JSON response",
            statusCode: 502
        );
    }
}).RequireRateLimiting("avatar");

// =====================================================
// START APPLICATION
// =====================================================

app.Run();

// =====================================================
// REQUEST MODELS
// =====================================================

record ChatRequest(
    string Message,
    string? Language,
    string? SessionId
);

// A restart clears the cache after credits have been topped up.
static class AvatarAvailability
{
    private static int _creditsExhausted;
    public static bool CreditsExhausted => Volatile.Read(ref _creditsExhausted) == 1;
    public static void MarkCreditsExhausted() => Interlocked.Exchange(ref _creditsExhausted, 1);
}
