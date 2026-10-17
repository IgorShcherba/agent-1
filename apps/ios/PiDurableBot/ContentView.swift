import SwiftUI

struct ContentView: View {
    var body: some View {
        NavigationStack {
            ContentUnavailableView(
                "Your assistant",
                systemImage: "bubble.left.and.bubble.right",
                description: Text("Conversations and tasks will appear here.")
            )
            .navigationTitle("Pi Durable Bot")
        }
    }
}

#Preview {
    ContentView()
}
