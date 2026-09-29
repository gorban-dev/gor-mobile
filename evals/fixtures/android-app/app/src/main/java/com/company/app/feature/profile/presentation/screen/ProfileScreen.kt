package com.company.app.feature.profile.presentation.screen

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.company.app.common.extensions.CollectWithLifecycle
import com.company.app.feature.profile.presentation.view.ProfileView
import com.company.app.feature.profile.presentation.viewmodel.ProfileViewAction
import com.company.app.feature.profile.presentation.viewmodel.ProfileViewModel

@Composable
fun ProfileScreen(
    viewModel: ProfileViewModel,
    onNavigateToEdit: () -> Unit
) {
    val viewState by viewModel.viewStates().collectAsStateWithLifecycle()

    viewModel.viewActions().CollectWithLifecycle { action ->
        when (action) {
            is ProfileViewAction.NavigateToEdit -> onNavigateToEdit()
        }
    }

    ProfileView(
        viewState = viewState,
        eventHandler = viewModel::handleEvent
    )
}