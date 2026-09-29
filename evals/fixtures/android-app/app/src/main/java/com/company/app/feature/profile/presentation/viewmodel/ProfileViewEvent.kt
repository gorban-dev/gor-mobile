package com.company.app.feature.profile.presentation.viewmodel

sealed class ProfileViewEvent {
    data object LoadProfile : ProfileViewEvent()
    data object OnEditClicked : ProfileViewEvent()
}