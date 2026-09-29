package com.company.app.feature.profile.presentation.view

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.company.app.feature.profile.presentation.viewmodel.ProfileViewEvent
import com.company.app.feature.profile.presentation.viewmodel.ProfileViewState

@Composable
fun ProfileView(
    viewState: ProfileViewState,
    eventHandler: (ProfileViewEvent) -> Unit
) {
    Box(modifier = Modifier.fillMaxSize()) {
        when {
            viewState.isLoading -> CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
            viewState.error != null -> Text(
                text = viewState.error,
                modifier = Modifier.align(Alignment.Center).padding(16.dp)
            )
            else -> Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
                Text(text = viewState.name)
                Text(text = viewState.email)
                Button(onClick = { eventHandler(ProfileViewEvent.OnEditClicked) }) {
                    Text(text = "Edit")
                }
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun ProfileViewPreview() {
    ProfileView(
        viewState = ProfileViewState(name = "Ann", email = "ann@example.com"),
        eventHandler = {}
    )
}