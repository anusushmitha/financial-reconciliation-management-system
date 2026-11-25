using System;
using System.IO;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using LendGuard.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;

namespace LendGuard.Infrastructure.Services;

public class FileStorageService : IFileStorageService
{
    private readonly string _basePath;
    private const long MaxFileSizeBytes = 25 * 1024 * 1024; // 25 MB

    public FileStorageService(IConfiguration configuration)
    {
        var configuredPath = configuration["FILE_STORAGE_PATH"];
        if (string.IsNullOrWhiteSpace(configuredPath))
        {
            configuredPath = Path.Combine(AppContext.BaseDirectory, "storage");
        }
        _basePath = Path.GetFullPath(configuredPath);

        Directory.CreateDirectory(Path.Combine(_basePath, "uploads"));
        Directory.CreateDirectory(Path.Combine(_basePath, "exports"));
    }

    public async Task<(string filePath, string fileHash)> SaveUploadAsync(Stream fileStream, string originalFileName, CancellationToken cancellationToken = default)
    {
        // 1. Sanitize filename and prevent path traversal
        var fileId = Guid.NewGuid().ToString("N");
        var baseName = Path.GetFileName(originalFileName);
        var cleanName = string.Join("_", baseName.Split(Path.GetInvalidFileNameChars()));
        if (string.IsNullOrWhiteSpace(cleanName)) cleanName = "upload.csv";

        var safeFileName = $"{fileId}_{cleanName}";
        var fullPath = Path.GetFullPath(Path.Combine(_basePath, "uploads", safeFileName));

        if (!fullPath.StartsWith(Path.Combine(_basePath, "uploads"), StringComparison.OrdinalIgnoreCase))
        {
            throw new UnauthorizedAccessException("Path traversal attempt detected in filename.");
        }

        using var sha256 = SHA256.Create();
        await using (var destinationStream = new FileStream(fullPath, FileMode.CreateNew, FileAccess.Write, FileShare.None))
        {
            var buffer = new byte[81920];
            int bytesRead;
            long totalBytesRead = 0;

            while ((bytesRead = await fileStream.ReadAsync(buffer, 0, buffer.Length, cancellationToken)) > 0)
            {
                totalBytesRead += bytesRead;
                if (totalBytesRead > MaxFileSizeBytes)
                {
                    destinationStream.Close();
                    if (File.Exists(fullPath)) File.Delete(fullPath);
                    throw new ArgumentException($"File exceeds maximum allowed size of {MaxFileSizeBytes / (1024 * 1024)}MB.");
                }

                sha256.TransformBlock(buffer, 0, bytesRead, null, 0);
                await destinationStream.WriteAsync(buffer.AsMemory(0, bytesRead), cancellationToken);
            }
            sha256.TransformFinalBlock(Array.Empty<byte>(), 0, 0);
        }

        var hash = Convert.ToHexString(sha256.Hash!).ToLowerInvariant();
        return (fullPath, hash);
    }

    public Task<Stream> OpenReadAsync(string filePath, CancellationToken cancellationToken = default)
    {
        var fullPath = Path.GetFullPath(filePath);
        if (!fullPath.StartsWith(_basePath, StringComparison.OrdinalIgnoreCase))
        {
            throw new UnauthorizedAccessException("Unauthorized file access or path traversal attempt.");
        }

        if (!File.Exists(fullPath))
        {
            throw new FileNotFoundException("File not found on storage.", filePath);
        }

        Stream stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        return Task.FromResult(stream);
    }

    public async Task<string> SaveExportAsync(string fileName, byte[] content, CancellationToken cancellationToken = default)
    {
        var fileId = Guid.NewGuid().ToString("N");
        var baseName = Path.GetFileName(fileName);
        var cleanName = string.Join("_", baseName.Split(Path.GetInvalidFileNameChars()));
        var safeFileName = $"{fileId}_{cleanName}";
        var fullPath = Path.GetFullPath(Path.Combine(_basePath, "exports", safeFileName));

        if (!fullPath.StartsWith(Path.Combine(_basePath, "exports"), StringComparison.OrdinalIgnoreCase))
        {
            throw new UnauthorizedAccessException("Path traversal attempt detected.");
        }

        await File.WriteAllBytesAsync(fullPath, content, cancellationToken);
        return fullPath;
    }
}
