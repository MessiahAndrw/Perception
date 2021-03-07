// Copyright 2021 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#pragma once

#include <functional>
#include <string>

#include "permebuf/Libraries/perception/window.permebuf.h"
#include "permebuf/Libraries/perception/window_manager.permebuf.h"

class WindowManager : ::permebuf::perception::WindowManager::Server {
public:
	typedef ::permebuf::perception::WindowManager WM;

	void HandleCreateWindow(
		::perception::ProcessId sender,
		Permebuf<WM::CreateWindowRequest> request,
		PermebufMiniMessageReplier<WM::CreateWindowResponse> responder);

	void HandleCloseWindow(
		::perception::ProcessId sender,
		const WM::CloseWindowMessage& message);

	void HandleSetWindowTexture(
		::perception::ProcessId sender,
		const WM::SetWindowTextureMessage& message);

	void HandleWindowTitle(
		::perception::ProcessId sender,
		Permebuf<WM::SetWindowTitleMessage> message);

	void HandleSystemButtonPushed(
		::perception::ProcessId sender,
		const WM::SystemButtonPushedMessage& message);
};
