# GLTF-Optimzer
Finds all GLB/GLTF files within input directory,
Removes all cameras and lights, then strips out dead nodes.
After which runs meshoptimizer to compress them.
Then saves to the output directory.
<br />

Requires:
- Download gltfpack.exe from [meshoptimizer](https://github.com/zeux/meshoptimizer)
- Put gltfpack.exe in this folder.
- Install node packages, then:
<br />

`node stripAllGLB.js "input/directory/path" "output/directory/path"`