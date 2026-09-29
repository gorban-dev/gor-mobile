package com.company.app.feature.profile.presentation.viewmodel

data class ProfileViewState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val name: String = "",
    val email: String = ""
)