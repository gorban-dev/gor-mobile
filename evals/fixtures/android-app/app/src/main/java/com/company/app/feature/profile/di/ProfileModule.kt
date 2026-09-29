package com.company.app.feature.profile.di

import com.company.app.feature.profile.data.datasource.ProfileRemoteDataSource
import com.company.app.feature.profile.data.repository.ProfileRepository
import com.company.app.feature.profile.domain.repository.IProfileRepository
import com.company.app.feature.profile.domain.usecase.GetProfileUseCase
import com.company.app.feature.profile.presentation.viewmodel.ProfileViewModel
import org.koin.androidx.viewmodel.dsl.viewModel
import org.koin.dsl.module

val profileModule = module {
    viewModel { ProfileViewModel(get()) }
    factory { GetProfileUseCase(get()) }
    single<IProfileRepository> { ProfileRepository(get()) }
    single { ProfileRemoteDataSource(get()) }
}