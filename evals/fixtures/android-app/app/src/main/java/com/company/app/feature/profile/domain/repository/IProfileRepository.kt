package com.company.app.feature.profile.domain.repository

import com.company.app.feature.profile.domain.usecase.ProfileData

interface IProfileRepository {
    suspend fun getProfile(): ProfileData
}