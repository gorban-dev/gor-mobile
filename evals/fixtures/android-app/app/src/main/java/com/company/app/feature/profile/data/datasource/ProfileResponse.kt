package com.company.app.feature.profile.data.datasource

import kotlinx.serialization.Serializable

@Serializable
data class ProfileResponse(
    val name: String,
    val email: String
)