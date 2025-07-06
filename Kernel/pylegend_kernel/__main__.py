
from ipykernel.kernelapp import IPKernelApp
from .kernel import PyLegendRouterKernel

IPKernelApp.launch_instance(kernel_class=PyLegendRouterKernel)
