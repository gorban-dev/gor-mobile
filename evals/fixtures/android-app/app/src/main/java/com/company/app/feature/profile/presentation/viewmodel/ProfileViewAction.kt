package com.company.app.feature.profile.presentation.viewmodel

sealed class ProfileViewAction {
    data object NavigateToEdit : ProfileViewAction()
}