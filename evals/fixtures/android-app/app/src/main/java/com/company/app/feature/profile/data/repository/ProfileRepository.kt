package com.company.app.feature.profile.data.repository

import com.company.app.feature.profile.data.datasource.ProfileRemoteDataSource
import com.company.app.feature.profile.domain.repository.IProfileRepository
import com.company.app.feature.profile.domain.usecase.ProfileData

class ProfileRepository(
    private val remoteDataSource: ProfileRemoteDataSource
) : IProfileRepository {

    override suspend fun getProfile(): ProfileData {
        val response = remoteDataSource.fetchProfile()
        return ProfileData(name = response.name, email = response.email)
    }
}