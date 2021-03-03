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

#include "types.h"

constexpr uint32 kBackgroundColor = (0 << 16) + (78 << 16) + (152 << 8);

#define WINDOW_TITLE_HEIGHT 12
#define WINDOW_BORDER_COLOUR 0x000000FF
#define WINDOW_TITLE_TEXT_COLOUR 0x000000FF

#define FOCUSED_WINDOW_COLOUR 0xC3C3C3FF
#define UNFOCUSED_WINDOW_COLOUR 0x8F8F8FFF
#define UNSELECTED_WINDOW_COLOUR 0x6D6D6DFF

#define WINDOW_NO_CONTENTS_COLOUR 0xE1E1E1FF
#define WINDOW_CLOSE_BUTTON_COLOUR 0xFF0000FF

#define HIGHLIGHTER_TINT 0x00000055
#define WINDOW_MINIMUM_HEIGHT (WINDOW_TITLE_HEIGHT * 3)

#define MAX_WINDOW_TITLE_LENGTH 80

#define MOUSE_WIDTH 11
#define MOUSE_HEIGHT 17

#define DIALOG_BORDER_WIDTH 2
#define DIALOG_BORDER_HEIGHT (WINDOW_TITLE_HEIGHT + 3)

#define SPLIT_FRAME_COLOUR 0xC3C3C3FF

#define SPLIT_BORDER_WIDTH 2
#define SPLIT_BORDER_COL_0 ((212 << 24) + (212 << 16) + (212 << 8))
#define SPLIT_BORDER_COL_1 ((199 << 24) + (199 << 16) + (199 << 8))

#define DIALOG_BORDER_COLOUR 0x00000FF
#define DIALOG_SHADOW_0 (40 | DIALOG_BORDER_COLOUR)
#define DIALOG_SHADOW_1 (10 | DIALOG_BORDER_COLOUR)
#define DIALOG_SHADOW_WIDTH 2

void InitializeCompositor();
void InvalidateScreen(int min_x, int min_y, int max_x, int max_y);
void DrawScreen();
