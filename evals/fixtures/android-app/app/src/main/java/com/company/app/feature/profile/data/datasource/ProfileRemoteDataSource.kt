package com.company.app.feature.profile.data.datasource

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get

class ProfileRemoteDataSource(
    private val httpClient: HttpClient
) {

    suspend fun fetchProfile(): ProfileResponse {
        return httpClient.get("/api/profile").body()
    }
}