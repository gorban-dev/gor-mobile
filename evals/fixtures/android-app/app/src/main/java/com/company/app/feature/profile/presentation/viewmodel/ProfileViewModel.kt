package com.company.app.feature.profile.presentation.viewmodel

import androidx.lifecycle.viewModelScope
import com.company.app.common.base.BaseSharedViewModel
import com.company.app.feature.profile.domain.usecase.GetProfileUseCase
import kotlinx.coroutines.launch

class ProfileViewModel(
    private val getProfileUseCase: GetProfileUseCase
) : BaseSharedViewModel<ProfileViewState, ProfileViewAction, ProfileViewEvent>(
    initialState = ProfileViewState()
) {

    override fun handleEvent(event: ProfileViewEvent) {
        when (event) {
            is ProfileViewEvent.LoadProfile -> loadProfile()
            is ProfileViewEvent.OnEditClicked -> sendAction(ProfileViewAction.NavigateToEdit)
        }
    }

    private fun loadProfile() {
        viewModelScope.launch {
            updateState { it.copy(isLoading = true, error = null) }
            getProfileUseCase.execute(Unit).fold(
                onSuccess = { data -> updateState { it.copy(isLoading = false, name = data.name, email = data.email) } },
                onFailure = { error -> updateState { it.copy(isLoading = false, error = error.message) } }
            )
        }
    }
}