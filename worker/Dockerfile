FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY backend/ backend/
COPY worker/ worker/
WORKDIR /src/worker
RUN dotnet publish -c Release -o /app LendGuard.Worker.csproj

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app .
ENTRYPOINT ["dotnet", "LendGuard.Worker.dll"]
