package com.company.app.feature.profile.domain.usecase

import com.company.app.common.domain.UseCase
import com.company.app.feature.profile.domain.repository.IProfileRepository

class GetProfileUseCase(
    private val repository: IProfileRepository
) : UseCase<Unit, Result<ProfileData>> {

    override suspend fun execute(params: Unit): Result<ProfileData> {
        return try {
            Result.success(repository.getProfile())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}